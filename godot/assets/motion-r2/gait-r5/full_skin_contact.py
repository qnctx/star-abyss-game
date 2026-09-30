"""Blender full-mesh contact calibration for authoring; no skin/rest mutations.

Use evaluated vertices, including mixed knee/ankle influences. The old heel/toe
proxy failed because some actual sole vertices have roughly 50/50 weights.
"""
import bpy
import numpy as np

class FullSkinSoles:
    def __init__(self,arm):
        self.entries=[]
        for obj in bpy.context.scene.objects:
            if obj.type!='MESH' or obj.parent!=arm:continue
            # Retain all original below-cuff vertices, not an ankle-only subset.
            masks={side:[] for side in ['L','R']}
            for v in obj.data.vertices:
                rest=obj.matrix_world@v.co
                if rest.z<.30:
                    masks['L' if rest.x<0 else 'R'].append(v.index)
            if any(masks.values()):self.entries.append((obj,{s:np.array(i,dtype=np.int32) for s,i in masks.items()}))

    def sample(self):
        bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
        heights={'L':1e9,'R':1e9};locations={}
        for obj,masks in self.entries:
            evaluated=obj.evaluated_get(deps);mesh=evaluated.to_mesh()
            data=np.empty(len(mesh.vertices)*3,dtype=np.float32);mesh.vertices.foreach_get('co',data);data=data.reshape(-1,3)
            matrix=np.array(obj.matrix_world);world=data@matrix[:3,:3].T+matrix[:3,3]
            for side,ids in masks.items():
                if len(ids)==0:continue
                vertex=int(ids[np.argmin(world[ids,2])]);height=float(world[vertex,2])
                if height<heights[side]:
                    heights[side]=height;locations[side]={'mesh':obj.name,'vertex':vertex,'world_blender':world[vertex].tolist()}
            evaluated.to_mesh_clear()
        return heights,locations

    def settle(self,targets,apply_pose,adjust_ankle,max_iterations=10,tolerance=.0005):
        """Callbacks apply authored pose and re-solve a leg of unchanged length.

        targets are desired complete shoe min heights above the local floor;
        caller determines stance/swing from the reviewed image/phase design.
        """
        total={'L':0.,'R':0.}
        for iteration in range(max_iterations):
            apply_pose();heights,locations=self.sample()
            errors={s:targets[s]-heights[s] for s in targets}
            if max(abs(e) for e in errors.values())<=tolerance:
                return {'iterations':iteration,'heights':heights,'correction':total,'lowest':locations,'converged':True}
            for side,error in errors.items():
                correction=max(-.04,min(.04,error))
                adjust_ankle(side,correction);total[side]+=correction
        apply_pose();heights,locations=self.sample()
        return {'iterations':max_iterations,'heights':heights,'correction':total,'lowest':locations,'converged':max(abs(targets[s]-heights[s]) for s in targets)<=tolerance}
