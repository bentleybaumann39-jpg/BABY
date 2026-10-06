"""
Squishy Ball Playground for Blender
===================================

Builds a soft, rubbery ball you can squish, drop and poke.

How to run it:
  1. Open Blender and switch to the "Scripting" tab.
  2. Click "Open", pick this file, then press "Run Script" (or Alt+P).
  3. Go back to the "Layout" tab and press Space to play.

The script makes a new scene called "Squishy Ball", so it won't touch your
other work. The ball falls onto the floor, wobbles, then a paddle comes
down and squashes it twice.

Things to play with (select the ball > Physics tab > Cloth):
  - Pressure > Pressure   : higher = firmer, bouncier ball (try 2 to 20)
  - Stiffness > Tension   : how stretchy the skin is (lower = jigglier)
  - Physical > Vertex Mass: heavier ball = bigger squish
  - Move or re-keyframe the "Squisher" paddle to squash it your own way,
    or press G on the "Poker" ball and drag it into the squishy ball while
    the animation plays.

After changing a setting, go back to frame 1 and play again so the
simulation recalculates.
"""

import math

import bpy

SCENE_NAME = "Squishy Ball"
FRAME_END = 220
BALL_COLOR = (1.0, 0.25, 0.55, 1.0)  # bubblegum pink


def new_scene():
    old = bpy.data.scenes.get(SCENE_NAME)
    if old is not None:
        bpy.data.scenes.remove(old)
    scene = bpy.data.scenes.new(SCENE_NAME)
    if bpy.context.window is not None:  # None when run with blender --background
        bpy.context.window.scene = scene
    scene.frame_start = 1
    scene.frame_end = FRAME_END
    return scene


def link(scene, obj):
    scene.collection.objects.link(obj)
    return obj


def set_input(node, names, value):
    """Set the first socket that exists (input names differ between versions)."""
    for name in names:
        if name in node.inputs:
            node.inputs[name].default_value = value
            return


def make_material(name, color, roughness, subsurface=0.0, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    set_input(bsdf, ["Base Color"], color)
    set_input(bsdf, ["Roughness"], roughness)
    set_input(bsdf, ["Subsurface Weight", "Subsurface"], subsurface)
    set_input(bsdf, ["Subsurface Radius"], (0.6, 0.2, 0.2))
    set_input(bsdf, ["Coat Weight", "Clearcoat"], coat)
    return mat


def make_mesh_object(scene, name, add_op, **kwargs):
    # Primitive operators add to the active collection, so build the object
    # and then move it into our scene's collection.
    add_op(**kwargs)
    obj = bpy.context.active_object
    obj.name = name
    for coll in list(obj.users_collection):
        coll.objects.unlink(obj)
    return link(scene, obj)


def add_collision(obj, thickness=0.02, friction=5.0):
    obj.modifiers.new("Collision", "COLLISION")
    obj.collision.thickness_outer = thickness
    obj.collision.cloth_friction = friction


def build_ball(scene):
    ball = make_mesh_object(
        scene, "Squishy Ball", bpy.ops.mesh.primitive_ico_sphere_add,
        subdivisions=4, radius=1.0, location=(0, 0, 3.0),
    )
    for poly in ball.data.polygons:
        poly.use_smooth = True

    cloth = ball.modifiers.new("Squish", "CLOTH")
    s = cloth.settings
    s.quality = 10
    s.mass = 0.3
    s.air_damping = 1.0
    s.tension_stiffness = 4.0
    s.compression_stiffness = 4.0
    s.shear_stiffness = 4.0
    s.bending_stiffness = 0.5
    s.tension_damping = 3.0
    s.compression_damping = 3.0
    s.shear_damping = 3.0
    # Pressure is what makes it act like a ball full of air instead of a
    # collapsing sheet.
    s.use_pressure = True
    s.uniform_pressure_force = 3.0
    s.pressure_factor = 4.0

    c = cloth.collision_settings
    c.collision_quality = 4
    c.distance_min = 0.015
    c.use_self_collision = False

    cloth.point_cache.frame_start = 1
    cloth.point_cache.frame_end = FRAME_END

    # Smooth it out after the simulation runs.
    subsurf = ball.modifiers.new("Smooth", "SUBSURF")
    subsurf.levels = 1
    subsurf.render_levels = 2

    ball.data.materials.append(
        make_material("Squishy Rubber", BALL_COLOR, 0.3, subsurface=0.25, coat=0.6)
    )
    return ball


def build_floor(scene):
    floor = make_mesh_object(
        scene, "Floor", bpy.ops.mesh.primitive_plane_add, size=30, location=(0, 0, 0),
    )
    add_collision(floor)
    floor.data.materials.append(
        make_material("Floor", (0.85, 0.85, 0.9, 1.0), 0.6)
    )
    return floor


def build_squisher(scene):
    paddle = make_mesh_object(
        scene, "Squisher", bpy.ops.mesh.primitive_cube_add, size=1, location=(0, 0, 4.5),
    )
    paddle.scale = (2.4, 2.4, 0.25)
    add_collision(paddle)
    paddle.data.materials.append(
        make_material("Squisher", (0.15, 0.6, 1.0, 1.0), 0.4)
    )

    # Up high -> press down -> let go -> press harder -> let go.
    keys = [
        (1, 4.5),
        (70, 4.5),
        (95, 1.25),
        (110, 1.25),
        (130, 4.5),
        (150, 4.5),
        (172, 0.85),
        (185, 0.85),
        (205, 4.5),
    ]
    for frame, z in keys:
        paddle.location.z = z
        paddle.keyframe_insert("location", index=2, frame=frame)
    return paddle


def build_poker(scene):
    """A small hard ball off to the side for you to grab (G) and poke with."""
    poker = make_mesh_object(
        scene, "Poker", bpy.ops.mesh.primitive_uv_sphere_add,
        radius=0.35, location=(3.0, 0, 0.35),
    )
    for poly in poker.data.polygons:
        poly.use_smooth = True
    add_collision(poker)
    poker.data.materials.append(
        make_material("Poker", (1.0, 0.8, 0.1, 1.0), 0.25)
    )
    return poker


def build_lights_and_camera(scene, target):
    cam_data = bpy.data.cameras.new("Camera")
    cam = link(scene, bpy.data.objects.new("Camera", cam_data))
    cam.location = (7.5, -7.5, 4.5)
    track = cam.constraints.new("TRACK_TO")
    track.target = target
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"
    scene.camera = cam

    key_data = bpy.data.lights.new("Key Light", "AREA")
    key_data.energy = 800
    key_data.size = 4
    key = link(scene, bpy.data.objects.new("Key Light", key_data))
    key.location = (4, -3, 6)
    key.rotation_euler = (math.radians(40), 0, math.radians(50))

    sun_data = bpy.data.lights.new("Sun", "SUN")
    sun_data.energy = 2.0
    sun = link(scene, bpy.data.objects.new("Sun", sun_data))
    sun.rotation_euler = (math.radians(35), math.radians(-20), math.radians(-30))

    world = bpy.data.worlds.new("Squishy World")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.55, 0.65, 0.8, 1.0)
    bg.inputs["Strength"].default_value = 0.6
    scene.world = world


def main():
    scene = new_scene()
    build_floor(scene)
    ball = build_ball(scene)
    build_squisher(scene)
    build_poker(scene)

    # The camera looks at an empty near the floor so the ball stays in frame.
    focus = link(scene, bpy.data.objects.new("Camera Focus", None))
    focus.location = (0, 0, 1.0)
    build_lights_and_camera(scene, focus)

    scene.frame_set(1)
    if bpy.context.scene == scene:
        for obj in scene.objects:
            obj.select_set(False)
        ball.select_set(True)
        bpy.context.view_layer.objects.active = ball
    print("Squishy ball ready! Press Space in the Layout tab to play.")


if __name__ == "__main__":
    main()
