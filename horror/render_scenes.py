"""
Renders the 3D shots for the analog horror tape.

Run with Blender's Python (either works):
    blender --background --python horror/render_scenes.py
    python horror/render_scenes.py        # with the `bpy` pip module

Writes PNG stills into horror/build/.
"""

import math
import os
import sys

import bpy

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build")
WIDTH, HEIGHT = 640, 480

HALL_W = 1.7
HALL_H = 2.5
HALL_L = 11.0


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.render.resolution_x = WIDTH
    scene.render.resolution_y = HEIGHT
    scene.render.image_settings.file_format = "PNG"
    world = bpy.data.worlds.new("Dark")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.002, 0.002, 0.003, 1)
    scene.world = world
    return scene


def material(name, color, roughness=0.8, emission=0.0, subsurface=0.0, grime=0.0):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    if subsurface:
        bsdf.inputs["Subsurface Weight"].default_value = subsurface
        bsdf.inputs["Subsurface Radius"].default_value = (0.4, 0.15, 0.1)
    if emission:
        bsdf.inputs["Emission Color"].default_value = color
        bsdf.inputs["Emission Strength"].default_value = emission
    if grime:
        # Blotchy stains: noise darkens the base color in patches.
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        noise = nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 4.0
        noise.inputs["Detail"].default_value = 8.0
        remap = nodes.new("ShaderNodeMapRange")
        remap.inputs["From Min"].default_value = 0.35
        remap.inputs["From Max"].default_value = 0.65
        remap.inputs["To Min"].default_value = 1.0 - grime
        remap.inputs["To Max"].default_value = 1.0
        hsv = nodes.new("ShaderNodeHueSaturation")
        hsv.inputs["Color"].default_value = color
        links.new(noise.outputs["Fac"], remap.inputs["Value"])
        links.new(remap.outputs["Result"], hsv.inputs["Value"])
        links.new(hsv.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def box(name, center, size, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    obj.data.materials.append(mat)
    return obj


def point_light(name, location, power, color=(1.0, 0.72, 0.45), radius=0.08):
    data = bpy.data.lights.new(name, "POINT")
    data.energy = power
    data.color = color
    data.shadow_soft_size = radius
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    bpy.context.scene.collection.objects.link(obj)
    return obj


def build_hallway():
    wall = material("Wallpaper", (0.26, 0.22, 0.14, 1), 0.9, grime=0.6)
    floor = material("Floorboards", (0.07, 0.04, 0.025, 1), 0.5, grime=0.5)
    ceiling = material("Ceiling", (0.3, 0.28, 0.24, 1), 0.95, grime=0.7)
    trim = material("Trim", (0.18, 0.13, 0.09, 1), 0.6)

    half = HALL_W / 2
    box("Floor", (0, HALL_L / 2, -0.05), (HALL_W + 0.4, HALL_L + 2, 0.1), floor)
    box("Ceiling", (0, HALL_L / 2, HALL_H + 0.05), (HALL_W + 0.4, HALL_L + 2, 0.1), ceiling)

    # Side walls built from segments so there are open doorways to the dark
    # rooms on either side: (side, start_y, end_y) of each doorway.
    doorways = {-1: [(2.2, 3.1), (7.0, 7.9)], 1: [(4.6, 5.5)]}
    for side, gaps in doorways.items():
        x = side * (half + 0.05)
        edges = [-1.0] + [v for g in gaps for v in g] + [HALL_L]
        for i in range(0, len(edges), 2):
            y0, y1 = edges[i], edges[i + 1]
            box(f"Wall{side}_{i}", (x, (y0 + y1) / 2, HALL_H / 2), (0.1, y1 - y0, HALL_H), wall)
        for y0, y1 in gaps:
            box(f"Lintel{side}_{y0}", (x, (y0 + y1) / 2, 2.25), (0.1, y1 - y0, 0.5), wall)
            for y in (y0, y1):
                box(f"Frame{side}_{y}", (x - side * 0.01, y, 1.0), (0.14, 0.08, 2.0), trim)

    # Far end: a wall with an open doorway into pitch black.
    end_y = HALL_L
    box("EndLeft", (-half / 2 - 0.25, end_y, HALL_H / 2), (half - 0.5, 0.1, HALL_H), wall)
    box("EndRight", (half / 2 + 0.25, end_y, HALL_H / 2), (half - 0.5, 0.1, HALL_H), wall)
    box("EndLintel", (0, end_y, 2.3), (1.0, 0.1, 0.4), wall)

    # Baseboards.
    for side in (-1, 1):
        box(f"Base{side}", (side * (half - 0.01), HALL_L / 2, 0.06), (0.03, HALL_L, 0.12), trim)

    # A picture frame on the right wall, for something familiar to look at.
    box("Picture", (half - 0.02, 2.4, 1.55), (0.03, 0.55, 0.42), trim)
    box("PictureInside", (half - 0.04, 2.4, 1.55), (0.02, 0.45, 0.32),
        material("Photo", (0.25, 0.22, 0.2, 1), 0.4))


def build_figure(location, head_tilt=22, lean=0.0, facing=180):
    """A very tall, very thin figure with a pale, empty face."""
    body = material("Figure", (0.01, 0.01, 0.01, 1), 0.9)
    skin = material("Face", (0.62, 0.6, 0.55, 1), 0.6, subsurface=0.2, grime=0.45)
    hollow = material("Hollow", (0.0, 0.0, 0.0, 1), 1.0)

    parts = []

    def add(op, mat, **kw):
        op(**kw)
        o = bpy.context.active_object
        o.data.materials.append(mat)
        parts.append(o)
        return o

    cyl = bpy.ops.mesh.primitive_cylinder_add
    sph = bpy.ops.mesh.primitive_uv_sphere_add
    for x in (-0.09, 0.09):  # legs
        add(cyl, body, radius=0.034, depth=1.25, location=(x, 0, 0.62))
    torso = add(cyl, body, radius=0.13, depth=0.85, location=(0, 0, 1.65))
    torso.scale = (1.0, 0.55, 1.0)
    add(cyl, body, radius=0.035, depth=0.3, location=(0, 0, 2.18))  # neck
    for x in (-0.2, 0.2):  # arms that hang far too low
        arm = add(cyl, body, radius=0.02, depth=1.55, location=(x, 0, 1.25))
        arm.rotation_euler = (0, math.radians(4 if x > 0 else -4), 0)
        for f in range(4):  # long fingers
            finger = add(cyl, body, radius=0.006, depth=0.3,
                         location=(x + (f - 1.5) * 0.012, 0.0, 0.34))
            finger.rotation_euler = (math.radians((f - 1.5) * 6), 0, 0)

    head = add(sph, skin, radius=0.13, location=(0, 0, 2.4), segments=48, ring_count=24)
    head.scale = (0.82, 0.95, 1.35)
    bpy.ops.object.shade_smooth()
    for x, size in ((-0.043, 0.029), (0.045, 0.025)):  # hollow, mismatched eyes
        eye = add(sph, hollow, radius=size, location=(x, -0.1, 2.465))
        eye.scale = (1.0, 0.8, 1.5)
    # Jaw hanging open far too long.
    mouth = add(sph, hollow, radius=0.05, location=(0.004, -0.095, 2.33))
    mouth.scale = (0.45, 0.6, 1.3)

    rig = bpy.data.objects.new("FigureRig", None)
    bpy.context.scene.collection.objects.link(rig)
    for p in parts:
        p.parent = rig
    # Tilt the whole head group by rotating parts above the neck around it.
    pivot_z = 2.25
    for p in parts:
        if p.location.z > pivot_z:
            dz = p.location.z - pivot_z
            dx = p.location.x
            a = math.radians(head_tilt)
            p.location.x = dx * math.cos(a) + dz * math.sin(a)
            p.location.z = pivot_z - dx * math.sin(a) + dz * math.cos(a)
            p.rotation_euler.y += a
    rig.location = location
    rig.rotation_euler = (math.radians(lean), 0, math.radians(facing - 180))
    return rig


def hallway_camera(lens=24, y=0.0, z=1.55, pitch=88, yaw=0.0):
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = lens
    cam = bpy.data.objects.new("Cam", cam_data)
    cam.location = (0.1, y, z)
    cam.rotation_euler = (math.radians(pitch), 0, math.radians(yaw))
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    return cam


def render(name):
    path = os.path.join(OUT, name + ".png")
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("rendered", path)


def hallway_shot(name, figure=None, lights=(32, 20, 7), **figure_kw):
    reset()
    build_hallway()
    for i, (y, power) in enumerate(zip((1.2, 5.0, 8.8), lights)):
        if power:
            point_light(f"Bulb{i}", (0, y, HALL_H - 0.12), power)
    if figure is not None:
        build_figure(figure, **figure_kw)
    hallway_camera()
    render(name)


def face_shot():
    reset()
    build_figure((0, 0, 0), head_tilt=28)
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = 32
    cam = bpy.data.objects.new("Cam", cam_data)
    cam.location = (0.07, -0.56, 2.36)
    cam.rotation_euler = (math.radians(92), 0, math.radians(2))
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    # Harsh light from below, like a flashlight held at the chest.
    point_light("Under", (0.02, -0.5, 1.95), 14, color=(1.0, 0.9, 0.8), radius=0.02)
    point_light("Rim", (0.4, 0.5, 2.8), 10, color=(0.6, 0.7, 1.0))
    render("face")


SHOTS = {
    "hall_empty": lambda: hallway_shot("hall_empty"),
    "hall_far": lambda: hallway_shot("hall_far", figure=(0.0, 10.4, 0.0)),
    "hall_mid": lambda: hallway_shot("hall_mid", figure=(0.25, 6.2, 0.0), head_tilt=35),
    # Sunk into the floor so its head clears the door frame (the legs are hidden).
    "hall_peek": lambda: hallway_shot("hall_peek", figure=(-0.95, 2.85, -0.6),
                                      head_tilt=-50, facing=200),
    "hall_close": lambda: hallway_shot("hall_close", figure=(0.1, 2.3, 0.0),
                                       head_tilt=15, lights=(32, 0, 0)),
    "hall_dark": lambda: hallway_shot("hall_dark", figure=(0.1, 1.6, 0.0),
                                      head_tilt=40, lights=(0, 0, 12)),
    "face": face_shot,
}


def main():
    os.makedirs(OUT, exist_ok=True)
    # Optionally render only the shots named on the command line.
    wanted = [a for a in sys.argv if a in SHOTS] or list(SHOTS)
    for name in wanted:
        SHOTS[name]()


if __name__ == "__main__":
    main()
