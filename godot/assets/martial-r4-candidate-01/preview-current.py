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
OUT.joinpath('preview-current').mkdir(exist_ok=True)
bpy.ops.import_scene.gltf(filepath=str(OUT/'charge.glb'))
qi=bpy.data.objects['charge']
# CPU approximation of the runtime UV alpha; no claim of shader/game parity.
for mat in qi.data.materials:
 mat.use_nodes=True;ns=mat.node_tree.nodes;ns.clear();ls=mat.node_tree.links
 uv=ns.new('ShaderNodeTexCoord');sep=ns.new('ShaderNodeSeparateXYZ');ls.new(uv.outputs['UV'],sep.inputs[0])
 mul=ns.new('ShaderNodeMath');mul.operation='MULTIPLY';mul.inputs[1].default_value=2;ls.new(sep.outputs['Y'],mul.inputs[0])
 sub=ns.new('ShaderNodeMath');sub.operation='SUBTRACT';sub.inputs[1].default_value=1;ls.new(mul.outputs[0],sub.inputs[0])
 ab=ns.new('ShaderNodeMath');ab.operation='ABSOLUTE';ls.new(sub.outputs[0],ab.inputs[0])
 edge=ns.new('ShaderNodeMath');edge.operation='SUBTRACT';edge.inputs[0].default_value=1;ls.new(ab.outputs[0],edge.inputs[1])
 power=ns.new('ShaderNodeMath');power.operation='POWER';power.inputs[1].default_value=.8;ls.new(edge.outputs[0],power.inputs[0])
 alpha=ns.new('ShaderNodeMath');alpha.operation='MULTIPLY';alpha.inputs[1].default_value=.72;ls.new(power.outputs[0],alpha.inputs[0])
 trans=ns.new('ShaderNodeBsdfTransparent');em=ns.new('ShaderNodeEmission');em.inputs['Color'].default_value=(.10,.62,.86,1);em.inputs['Strength'].default_value=.75
 mix=ns.new('ShaderNodeMixShader');ls.new(alpha.outputs[0],mix.inputs[0]);ls.new(trans.outputs[0],mix.inputs[1]);ls.new(em.outputs[0],mix.inputs[2]);out=ns.new('ShaderNodeOutputMaterial');ls.new(mix.outputs[0],out.inputs['Surface'])
bpy.ops.mesh.primitive_plane_add(size=6,location=(0,0,-.01));bpy.context.object.name='QA_ground_reference_only'
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
  name=f'{clip}-{int(t*100):02d}-{view}.png';scene.render.filepath=str(OUT/'preview-current'/name);bpy.ops.render.render(write_still=True)
  entries.append({'clip':clip,'normalized':t,'view':view,'path':'preview-current/'+name})
(OUT/'preview/index.json').write_text(json.dumps({'scope':'Offline C2 Cycles CPU supplemental pose study; not Godot default-camera or normal-speed acceptance; approximate UV opacity, QA ground plane only','images':entries},indent=2))
