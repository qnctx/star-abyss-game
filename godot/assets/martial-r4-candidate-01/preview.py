import bpy, math, json
from pathlib import Path
from mathutils import Vector
OUT=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(OUT.parent/'motion-r2/c2-motion-r2.glb'))
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
arm.animation_data_clear()
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
with bpy.data.libraries.load(str(OUT/'source/c2-martial-r4.blend'),link=False) as (src,dst): dst.actions=src.actions
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=12
scene.render.resolution_x=480;scene.render.resolution_y=560;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('studio-world');scene.world.color=(.10,.10,.10)
scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='AgX'
for xyz,power,size in [((3,-4,5),750,4),((-3,2,3),500,3)]:
 data=bpy.data.lights.new('studio','AREA');data.energy=power;data.shape='DISK';data.size=size
 obj=bpy.data.objects.new('studio',data);scene.collection.objects.link(obj);obj.location=xyz;obj.rotation_euler=(Vector((0,0,1))-obj.location).to_track_quat('-Z','Y').to_euler()
camdata=bpy.data.cameras.new('candidate-camera');cam=bpy.data.objects.new('candidate-camera',camdata);scene.collection.objects.link(cam);scene.camera=cam;camdata.lens=48
OUT.joinpath('preview').mkdir(exist_ok=True)
bpy.ops.import_scene.gltf(filepath=str(OUT/'charge.glb'))
qi=bpy.data.objects['charge']
entries=[]
for clip,t in [('cast_martial_break',.30),('cast_martial_break',.5),('air_cast_martial_descent',.5),('air_cast_martial_descent_cancel',0),('cast_martial_landing',.18)]:
 action=bpy.data.actions[clip];arm.animation_data_create();arm.animation_data.action=action
 if action.slots: arm.animation_data.action_slot=action.slots[0]
 scene.frame_set(round(t*({'cast_martial_break':114,'air_cast_martial_descent':84,'cast_martial_landing':54,'air_cast_martial_descent_cancel':24}[clip])))
 bpy.context.view_layer.update()
 qi.hide_render=clip!='cast_martial_break' or t>.35
 qi.location=arm.matrix_world@((arm.pose.bones['wristL'].head+arm.pose.bones['wristR'].head)*.5)
 for view,xyz in [('back',(0,-5,2.25)),('side',(4,-.15,1.5))]:
  cam.location=xyz;cam.rotation_euler=(Vector((0,0,1))-cam.location).to_track_quat('-Z','Y').to_euler()
  name=f'{clip}-{int(t*100):02d}-{view}.png';scene.render.filepath=str(OUT/'preview'/name);bpy.ops.render.render(write_still=True)
  entries.append({'clip':clip,'normalized':t,'view':view,'path':'preview/'+name})
(OUT/'preview/index.json').write_text(json.dumps({'scope':'Offline C2 Cycles CPU supplemental pose study; not Godot default-camera or normal-speed acceptance','images':entries},indent=2))
