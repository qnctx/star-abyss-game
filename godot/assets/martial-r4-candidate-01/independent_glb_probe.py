from pathlib import Path
import json,struct,numpy as np,math,sys,hashlib
sys.stdout.reconfigure(encoding='utf-8')
p=Path('godot/assets/martial-r4-candidate-01');data=(p/'c2-martial-r4.glb').read_bytes();digest=hashlib.sha256(data).hexdigest();jlen=struct.unpack_from('<I',data,12)[0];g=json.loads(data[20:20+jlen]);off=20+jlen;blen=struct.unpack_from('<I',data,off)[0];buf=data[off+8:off+8+blen]
def accessor(idx):
 a=g['accessors'][idx];v=g['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];o=v.get('byteOffset',0)+a.get('byteOffset',0)
 return np.frombuffer(buf,dtype='<f4',count=a['count']*n,offset=o).reshape(-1,n).astype(float)
def qm(q):
 x,y,z,w=q
 return np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],[2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],[2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]])
def sample(name,t):
 a=next(a for a in g['animations'] if a['name']==name);trs={i:{k:n.get(k,d) for k,d in [('translation',[0,0,0]),('rotation',[0,0,0,1]),('scale',[1,1,1])]} for i,n in enumerate(g['nodes'])}
 duration=max(accessor(s['input'])[-1,0] for s in a['samplers']);seconds=t*duration
 for c in a['channels']:
  s=a['samplers'][c['sampler']];ts=accessor(s['input'])[:,0];values=accessor(s['output']);idx=int(np.argmin(abs(ts-seconds)));trs[c['target']['node']][c['target']['path']]=values[idx]
 parents={ch:i for i,n in enumerate(g['nodes']) for ch in n.get('children',[])};mats={}
 def mat(i):
  if i in mats:return mats[i]
  tr=trs[i];m=np.eye(4);m[:3,:3]=qm(tr['rotation'])@np.diag(tr['scale']);m[:3,3]=tr['translation'];mats[i]=mat(parents[i])@m if i in parents else m;return mats[i]
 return {n['name']:mat(i) for i,n in enumerate(g['nodes']) if 'name' in n}
summary=[]
for name,t in [('cast_martial_break',.30),('cast_martial_cancel',0),('air_cast_martial_descent',.5),('air_cast_martial_descent_cancel',0),('air_cast_martial_descent_cancel',1),('cast_martial_landing',.18)]:
 mats=sample(name,t);pts={n:np.round(mats[n][:3,3],6).tolist() for n in ['pelvis','chest','head','shoulderL','elbowL','wristL','shoulderR','elbowR','wristR','hipL','kneeL','ankleL','hipR','kneeR','ankleR']}
 row={'clip':name,'normalized':t,'positions':pts}
 for side in ['L','R']:
  h,k,a=[mats[n+side][:3,3] for n in ['hip','knee','ankle']];u=h-k;v=a-k
  row['knee_'+side+'_interior_degrees']=math.degrees(math.acos(np.clip(np.dot(u,v)/np.linalg.norm(u)/np.linalg.norm(v),-1,1)))
 summary.append(row)
comparisons=[]
for air in ['', 'air_']:
 for source,st,target,tt in [('descent',.5,'descent_cancel',0),('break',.30,'cancel',0)]:
  a=sample(air+'cast_martial_'+source,st);b=sample(air+'cast_martial_'+target,tt)
  ds=[{'node':n,'position_delta_m':float(np.linalg.norm(a[n][:3,3]-b[n][:3,3])),'matrix_max_delta':float(np.max(abs(a[n]-b[n])))} for n in a]
  comparisons.append({'source':air+source,'target':air+target,'max_position_delta_m':max(x['position_delta_m'] for x in ds),'max_matrix_delta':max(x['matrix_max_delta'] for x in ds),'mismatches':[x for x in ds if x['matrix_max_delta']>1e-5]})
report={'scope':'CPU GLB nearest-key samples only; no Blender/Godot invocation or visual acceptance.','glb_sha256':digest,'samples':summary,'pose_start_comparisons':comparisons}
name='independent-glb-resample-'+digest[:12]+'.json';(p/name).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')


def source_asset(path):
 d=path.read_bytes();n=struct.unpack_from('<I',d,12)[0];j=json.loads(d[20:20+n]);o=20+n;size=struct.unpack_from('<I',d,o)[0];return j,d[o+8:o+8+size]
sg,sbuf=source_asset(p.parent/'motion-r2/c2-motion-r2.glb')
def sa(idx):
 a=sg['accessors'][idx];v=sg['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];d={5126:'<f4',5121:'u1',5123:'<u2',5125:'<u4'}[a['componentType']];o=v.get('byteOffset',0)+a.get('byteOffset',0)
 return np.frombuffer(sbuf,dtype=d,count=a['count']*n,offset=o).reshape(-1,n)
def source_rest():
 parents={ch:i for i,n in enumerate(sg['nodes']) for ch in n.get('children',[])};out={}
 def node_mat(i):
  if i in out:return out[i]
  n=sg['nodes'][i];m=np.eye(4);m[:3,:3]=qm(n.get('rotation',[0,0,0,1]))@np.diag(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0]);out[i]=node_mat(parents[i])@m if i in parents else m;return out[i]
 return {n['name']:node_mat(i) for i,n in enumerate(sg['nodes']) if 'name' in n}
def skin_bounds(poses):
 result=[]
 for node in sg['nodes']:
  if 'mesh' not in node or 'skin' not in node:continue
  skin=sg['skins'][node['skin']];ibm=sa(skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1);joint_names=[sg['nodes'][j]['name'] for j in skin['joints']];xf=np.array([poses[j]@b for j,b in zip(joint_names,ibm)]);all_points=[];all_bones=[]
  for primitive in sg['meshes'][node['mesh']]['primitives']:
   att=primitive['attributes'];v=sa(att['POSITION']).astype(float);j=sa(att['JOINTS_0']).astype(int);w=sa(att['WEIGHTS_0']).astype(float);hom=np.column_stack([v,np.ones(len(v))]);out=np.zeros((len(v),4))
   for k in range(4):out+=np.einsum('nij,nj->ni',xf[j[:,k]],hom)*w[:,k,None]
   all_points.append(out[:,:3]);all_bones.extend(joint_names[index] for index in j[np.arange(len(j)),np.argmax(w,axis=1)])
  v=np.concatenate(all_points);mi=int(np.argmin(v[:,1]));result.append({'mesh':node['name'],'min':v.min(axis=0).tolist(),'max':v.max(axis=0).tolist(),'minimum_y_vertex':v[mi].tolist(),'dominant_joint_at_minimum_y':all_bones[mi],'vertices_below_y0':int(np.count_nonzero(v[:,1]<0))})
 return result
report['skinned_geometry']={'method':'CPU linear blend skinning of original motion-r2 mesh vertices and inverse-bind matrices with candidate GLB node matrices. Authored coordinates only; no runtime Motion foot-lock, sole shift or collider adaptation.','rest_control':skin_bounds(source_rest()),'landing_peak':skin_bounds(sample('cast_martial_landing',.18)),'descent_held':skin_bounds(sample('air_cast_martial_descent',.5))}
def candidate_rest():
 parents={ch:i for i,n in enumerate(g['nodes']) for ch in n.get('children',[])};out={}
 def node_mat(i):
  if i in out:return out[i]
  n=g['nodes'][i];m=np.eye(4);m[:3,:3]=qm(n.get('rotation',[0,0,0,1]))@np.diag(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0]);out[i]=node_mat(parents[i])@m if i in parents else m;return out[i]
 return {n['name']:node_mat(i) for i,n in enumerate(g['nodes']) if 'name' in n}
cr,sr=candidate_rest(),source_rest();common=sorted(cr.keys()&sr.keys());rest_delta={n:float(np.max(abs(cr[n]-sr[n]))) for n in common}
skin=g['skins'][0];cs={g['nodes'][i]['name']:m.reshape(4,4).T for i,m in zip(skin['joints'],accessor(skin['inverseBindMatrices']))};skin=sg['skins'][0];ss={sg['nodes'][i]['name']:m.reshape(4,4).T for i,m in zip(skin['joints'],sa(skin['inverseBindMatrices']))};bind_delta={n:float(np.max(abs(cs[n]-ss[n]))) for n in cs.keys()&ss.keys()}
report['rest_comparison']={'baseline':'godot/assets/motion-r2/c2-motion-r2.glb','baseline_sha256':hashlib.sha256((p.parent/'motion-r2/c2-motion-r2.glb').read_bytes()).hexdigest(),'common_named_nodes':len(common),'common_inverse_bind_matrices':len(bind_delta),'max_world_matrix_delta':max(rest_delta.values()),'world_matrix_mismatches_above_1e_5':{n:d for n,d in rest_delta.items() if d>1e-5},'max_inverse_bind_matrix_delta':max(bind_delta.values()),'inverse_bind_mismatches_above_1e_5':{n:d for n,d in bind_delta.items() if d>1e-5}}
landing=sample('cast_martial_landing',.18)
report['landing_left_arm']={'wrist_minus_shoulder_m':(landing['wristL'][:3,3]-landing['shoulderL'][:3,3]).tolist(),'wrist_minus_head_m':(landing['wristL'][:3,3]-landing['head'][:3,3]).tolist(),'coordinate_note':'In these authored glTF samples, negative Z is forward; positive Z relative to shoulder is backward.'}
animation=next(a for a in g['animations'] if a['name']=='cast_martial_landing');times=accessor(animation['samplers'][0]['input'])[:,0];duration=float(times[-1]);whole={};knees={n:{'min_y':float('inf')} for n in ['kneeL','kneeR']}
for second in times:
 norm=float(second/duration);pose=sample('cast_martial_landing',norm)
 for row in skin_bounds(pose):
  name_=row['mesh']
  if name_ not in whole or row['min'][1]<whole[name_]['minimum_y']:
   whole[name_]={'minimum_y':row['min'][1],'normalized_key':norm,'seconds':float(second),'vertex':row['minimum_y_vertex'],'dominant_joint':row['dominant_joint_at_minimum_y'],'vertices_below_y0_at_key':row['vertices_below_y0']}
 for knee,row in knees.items():
  if pose[knee][1,3]<row['min_y']:row.update(min_y=float(pose[knee][1,3]),normalized_key=norm)
report['landing_all_baked_keys']={'sample_count':len(times),'duration_seconds':duration,'scope':'Every authored landing key; not interpolation between keys and not runtime ground adaptation.','mesh_minima':whole,'knee_minima':knees}
(p/name).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'report':name,'sha256':digest,'pose_start_comparisons':comparisons,'landing_sample':summary[-1],'rest_comparison':report['rest_comparison'],'landing_left_arm':report['landing_left_arm'],'landing_all_baked_keys':report['landing_all_baked_keys']},ensure_ascii=False,indent=2))

