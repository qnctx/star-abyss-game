import bpy,json,hashlib,shutil,numpy as np
from pathlib import Path
p=Path('godot/assets/motion-r2').resolve();root=p.parents[2]
backup=p/'source/gait-r6-before'
files=[p/'source/c2-motion-r2.blend',p/'c2-motion-r2.glb',p/'clips.json',p/'build_gait_r4.py',p/'gait_r4.py',root/'godot/scripts/native_motion_r2.gd']
if backup.exists():
    raise RuntimeError('R6 backup already exists; inspect and never overwrite')
backup.mkdir()
report={}
for src in files:
    dst=backup/src.name;shutil.copy2(src,dst)
    report[str(src.relative_to(root))]={'backup':dst.name,'sha256':hashlib.sha256(dst.read_bytes()).hexdigest(),'bytes':dst.stat().st_size}
(backup/'snapshot.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.open_mainfile(filepath=str(p/'source/c2-motion-r2.blend'))
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
result={}
for side in ['L','R']:
    pool=[]
    for obj in bpy.context.scene.objects:
        if obj.type!='MESH' or obj.parent!=arm:continue
        for v in obj.data.vertices:
            pos=obj.matrix_world@v.co
            if pos.z<.06 and (pos.x<0)==(side=='L'):pool.append([pos.x,pos.z,-pos.y])
    a=np.array(pool);cov=np.cov(a[:,[0,2]].T);w,v=np.linalg.eigh(cov);axis=v[:,-1]
    if axis[1]>0:axis=-axis
    result[side]={'count':len(pool),'min':a.min(axis=0).tolist(),'max':a.max(axis=0).tolist(),'long_axis_xz_forward':axis.tolist(),'inferred_yaw_deg':float(np.degrees(np.arctan2(-axis[0],-axis[1]))),'toe_centroid':a[a[:,2]<np.quantile(a[:,2],.15)].mean(axis=0).tolist(),'heel_centroid':a[a[:,2]>np.quantile(a[:,2],.85)].mean(axis=0).tolist()}
(p/'gait-review-r6/foot-rest-inspection.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
