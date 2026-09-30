"""Local Blender animation pass from the existing generated R11/prowler references.

Preserve the sculpted mesh, skin weights, original PBR materials and all old clips.
No network, image generation or paid model service. In-place actions: Godot owns
root travel, collision, target sensing, attack contact and the shared clock.
"""
import bpy
import math
import json
import hashlib
from pathlib import Path
from mathutils import Quaternion, Vector

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
REFERENCES = [ROOT / 'docs/art/creatures/riftwing-r11/concept.png', ROOT / 'docs/art/creatures/rift-prowler-v1/concept.png']
assert all(p.exists() for p in REFERENCES), 'Generated reference must exist before the 3D pass'
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'playable/assets/creatures/riftwing-r11/riftwing-r11.blend'))
bpy.context.preferences.filepaths.save_version = 0
arm = bpy.data.objects['RiftwingRig']
body = bpy.data.objects['RiftwingBody']
wings = bpy.data.objects['RiftwingMembraneWings']
arm.animation_data.action = None
for track in arm.animation_data.nla_tracks:
    track.mute = True

def q(axis, angle):
    return Quaternion(axis, angle)

def rot(name, x=0.0, y=0.0, z=0.0):
    arm.pose.bones[name].rotation_quaternion = q((1, 0, 0), x) @ q((0, 1, 0), y) @ q((0, 0, 1), z)

def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)

def keyvalue(t, knots):
    for a, b in zip(knots, knots[1:]):
        if t <= b[0]:
            return a[1] + (b[1] - a[1]) * ease((t - a[0]) / (b[0] - a[0]))
    return knots[-1][1]

def neutral(air=False):
    for bone in arm.pose.bones:
        bone.rotation_mode = 'QUATERNION'
        bone.rotation_quaternion = (1, 0, 0, 0)
        bone.location = (0, 0, 0)
        bone.scale = (1, 1, 1)
    for side, s in [('L', -1), ('R', 1)]:
        rot(f'Wing_{side}_Root', y=-s * .12 if air else 0, z=0 if air else -s * 1.13)
        rot(f'Wing_{side}_Tip', z=0 if air else -s * .93)
    if air:
        for leg in ['LF', 'RF', 'LH', 'RH']:
            rot(leg + '_Upper', .26)
            rot(leg + '_Lower', -.22)

# These authored contact times match MOVES in native_enemy_r3.gd.
specs = [
    ('ground-claw', .48, .14, .82),
    ('r3-lunge', .82, .36, 1.18),
    ('r3-tail', .72, .22, 1.0),
    ('r3-rise', .86, .30, 1.18),
    ('r3-shard', 1.05, .12, 1.05),
    ('sweep', .65, .20, 1.1),
    ('dive', .95, .50, 1.4),
]

def pose(name, t, windup, active, duration):
    airborne = name in ['sweep', 'dive']
    neutral(airborne)
    launch = name in ['r3-lunge', 'r3-rise', 'dive']
    contact = windup + (active * .65 if launch else 0)
    anticipation = keyvalue(t, [(0, 0), (windup * .67, 1), (windup, .82), (contact + .12, 0), (duration, 0)])
    strike = keyvalue(t, [(0, 0), (windup * .8, 0), (contact, 1), (contact + .14, .8), (duration, 0)])
    recover = keyvalue(t, [(0, 0), (contact, 0), (contact + .25, 1), (duration, 0)])
    rot('Pelvis', x=-.08 * anticipation, z=.08 * anticipation)
    rot('Spine', x=.10 * anticipation - .10 * strike, z=-.10 * anticipation)
    rot('Chest', x=.10 * anticipation - .14 * strike, z=.12 * anticipation - .08 * strike)
    rot('Neck', x=-.12 * anticipation + .12 * strike)
    rot('Head', x=.08 * anticipation - .05 * strike)
    rot('Tail01', y=-.12 * anticipation + .15 * strike)
    rot('Tail02', y=.20 * anticipation - .20 * strike)
    arm.pose.bones['Root'].location.y = -.07 * anticipation
    if name in ['ground-claw', 'r3-lunge', 'r3-rise']:
        rot('RF_Upper', -.62 * anticipation + 1.08 * strike)
        rot('RF_Lower', .62 * anticipation + .05 * strike)
        rot('RF_Foot', -.28 * strike)
        rot('LF_Upper', -.10 * anticipation + .13 * strike)
        rot('LH_Upper', -.16 * anticipation + .25 * strike)
        rot('RH_Upper', -.16 * anticipation + .25 * strike)
        rot('LH_Lower', .18 * anticipation - .16 * strike)
        rot('RH_Lower', .18 * anticipation - .16 * strike)
        if name == 'r3-lunge':
            arm.pose.bones['Root'].location.y -= .09 * anticipation
            rot('LF_Upper', -.40 * anticipation + .75 * strike)
            rot('LF_Lower', .42 * anticipation)
            rot('Chest', x=.22 * anticipation - .24 * strike)
            rot('Head', x=-.06 * strike)
        if name == 'r3-rise':
            rot('Root', x=.07 * anticipation - .30 * strike)
            rot('LF_Upper', -.50 * anticipation + .95 * strike)
            rot('LF_Lower', .55 * anticipation + .05 * strike)
            for side, s in [('L', -1), ('R', 1)]:
                rot(f'Wing_{side}_Root', y=-s * .35 * strike, z=-s * 1.13 * (1 - .85 * strike))
                rot(f'Wing_{side}_Tip', z=-s * .93 * (1 - strike))
    elif name == 'r3-tail':
        # Hips lead, chest counters, the two tail segments follow in sequence.
        turn = -.62 * anticipation + 1.18 * strike
        rot('Pelvis', z=turn)
        rot('Spine', z=-turn * .55)
        rot('Chest', z=-turn * .30)
        rot('Neck', z=-turn * .20)
        rot('Tail01', x=.10, z=-.72 * anticipation + 1.05 * strike)
        rot('Tail02', x=.08, z=-.62 * anticipation + 1.20 * strike)
        rot('LH_Upper', x=-.18 * anticipation)
        rot('RH_Upper', x=.16 * strike)
    elif name == 'r3-shard':
        # Thorax expands, head tilts back, neck snaps forward at the jaw source.
        rot('Chest', x=-.20 * anticipation + .20 * strike)
        rot('Neck', x=-.35 * anticipation + .24 * strike)
        rot('Head', x=-.24 * anticipation + .18 * strike)
        arm.pose.bones['Chest'].scale = (1 + .025 * anticipation, 1 + .045 * anticipation, 1 + .035 * anticipation)
        for side, s in [('L', -1), ('R', 1)]:
            rot(f'Wing_{side}_Root', y=-s * .12 * anticipation, z=-s * (1.13 - .20 * anticipation))
    elif name == 'sweep':
        rot('Root', z=-.16 * anticipation + .25 * strike)
        rot('Chest', z=-.20 * anticipation + .36 * strike)
        rot('Wing_R_Root', x=.10, y=-.30 * anticipation + .70 * strike, z=-.20 * anticipation + .48 * strike)
        rot('Wing_R_Tip', y=-.28 * anticipation + .55 * strike)
        rot('Wing_L_Root', y=.10, z=-.20 * strike)
        rot('Tail01', z=.20 * anticipation - .35 * strike)
    elif name == 'dive':
        rot('Root', x=-.22 * anticipation + .48 * strike)
        rot('Neck', x=.15 * anticipation - .18 * strike)
        rot('Head', x=-.10 * strike)
        for side, s in [('L', -1), ('R', 1)]:
            rot(f'Wing_{side}_Root', y=-s * (.25 * anticipation - .52 * strike), z=-s * .70 * strike)
            rot(f'Wing_{side}_Tip', z=-s * .52 * strike)
        for leg in ['LF', 'RF']:
            rot(leg + '_Upper', .12 * anticipation + .58 * strike)
            rot(leg + '_Lower', -.22 * anticipation + .08 * strike)

def remove_action(name):
    for track in list(arm.animation_data.nla_tracks):
        if any(strip.action and strip.action.name == name for strip in track.strips):
            arm.animation_data.nla_tracks.remove(track)
    old = bpy.data.actions.get(name)
    if old:
        bpy.data.actions.remove(old)

for name, windup, active, recovery in specs:
    remove_action(name)
    duration = windup + active + recovery
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    arm.animation_data.action = action
    frames = math.ceil(duration * 30)
    for frame in range(frames + 1):
        t = frame / 30
        pose(name, t, windup, active, duration)
        # Keep grounded strikes on the contact plane; root travel belongs to AI.
        if name not in ['sweep', 'dive', 'r3-rise']:
            bpy.context.view_layer.update()
            evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
            mesh = evaluated.to_mesh()
            low = min(v.co.z for v in mesh.vertices)
            evaluated.to_mesh_clear()
            arm.pose.bones['Root'].location.y -= low
        for bone in arm.pose.bones:
            bone.keyframe_insert('rotation_quaternion', frame=frame, group=bone.name)
            bone.keyframe_insert('location', frame=frame, group=bone.name)
            bone.keyframe_insert('scale', frame=frame, group=bone.name)
    track = arm.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 0, action)
    track.mute = True

arm.animation_data.action = bpy.data.actions.get('ground-idle')
bpy.context.scene.render.fps = 30
bpy.context.scene.frame_start = 0
bpy.context.scene.frame_end = 60
bpy.context.scene.frame_set(0)
bpy.ops.file.pack_all()
(OUT / 'source').mkdir(exist_ok=True)
(OUT / 'source/.gdignore').write_text('', encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'source/riftwing-r3.blend'))

def export(path, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for item in objects:
        item.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_yup=True,
        export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True)

export(OUT / 'riftwing-r3.glb', [arm, body, wings])
export(OUT / 'rift-prowler-r3.glb', [arm, body])
report = {'references': [{'path': str(p.relative_to(ROOT)), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in REFERENCES],
          'source': 'playable/assets/creatures/riftwing-r11/riftwing-r11.blend',
          'preserves': 'body sculpt, skin weights, original materials, wing geometry and original locomotion clips',
          'new_actions': [{'id': n, 'windup': w, 'active': a, 'recovery': r} for n, w, a, r in specs],
          'clips': [a.name for a in bpy.data.actions], 'paid_generation_calls': 0,
          'ground_variant': 'same original prowler body, excludes additional wing mesh',
          'root_motion': 'none: physical root travel and height remain engine owned'}
(OUT / 'manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('ENEMY_R3_BUILD', json.dumps(report, ensure_ascii=False))
