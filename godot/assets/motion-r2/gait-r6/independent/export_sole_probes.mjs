// Exports fixed material probes, independently of production authoring code.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const [baselinePath,candidatePath,outputPath]=process.argv.slice(2);
if(!baselinePath||!candidatePath||!outputPath)throw Error('Usage: node export_sole_probes.mjs BASELINE.glb CANDIDATE.glb OUTPUT.json');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const multiply=(a,b)=>Array.from({length:16},(_,i)=>{const c=Math.floor(i/4),r=i%4;return a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];});
const transform=(m,p)=>[0,1,2].map(i=>m[i]*p[0]+m[4+i]*p[1]+m[8+i]*p[2]+m[12+i]);
const lerp=(a,b,u)=>a.map((x,i)=>x+u*(b[i]-x));
const dot=(a,b)=>a.reduce((r,x,i)=>r+x*b[i],0);
function slerp(a,b,u){let d=dot(a,b);if(d<0){d=-d;b=b.map(x=>-x);}if(d>.9995){const q=lerp(a,b,u),l=Math.sqrt(dot(q,q));return q.map(x=>x/l);}const t=Math.acos(Math.min(1,d)),s=Math.sin(t);return a.map((x,i)=>(Math.sin((1-u)*t)*x+Math.sin(u*t)*b[i])/s);}
function compose(t=[0,0,0],q=[0,0,0,1],s=[1,1,1]){const[x,y,z,w]=q;return[(1-2*(y*y+z*z))*s[0],2*(x*y+z*w)*s[0],2*(x*z-y*w)*s[0],0,2*(x*y-z*w)*s[1],(1-2*(x*x+z*z))*s[1],2*(y*z+x*w)*s[1],0,2*(x*z+y*w)*s[2],2*(y*z-x*w)*s[2],(1-2*(x*x+y*y))*s[2],0,...t,1];}
function load(file){
  const bytes=fs.readFileSync(file);if(bytes.toString('ascii',0,4)!=='glTF')throw Error('Expected GLB');let doc,bin;
  for(let p=12;p<bytes.length;){const n=bytes.readUInt32LE(p),t=bytes.readUInt32LE(p+4);if(t===0x4e4f534a)doc=JSON.parse(bytes.toString('utf8',p+8,p+8+n).trim());if(t===0x004e4942)bin=bytes.subarray(p+8,p+8+n);p+=8+n;}
  const cache=new Map();
  function accessor(id){if(cache.has(id))return cache.get(id);const a=doc.accessors[id];if(a.sparse)throw Error('Sparse accessor unsupported');const v=doc.bufferViews[a.bufferView];if(v.buffer!==0)throw Error('External buffer unsupported');const w={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],fmt={5120:[1,'readInt8',127],5121:[1,'readUInt8',255],5122:[2,'readInt16LE',32767],5123:[2,'readUInt16LE',65535],5125:[4,'readUInt32LE',4294967295],5126:[4,'readFloatLE',1]}[a.componentType];if(!w||!fmt)throw Error('Unsupported format');const[size,read,divisor]=fmt,base=(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??size*w;const rows=Array.from({length:a.count},(_,i)=>Array.from({length:w},(_,j)=>{const x=bin[read](base+i*stride+j*size);return a.normalized?Math.max(-1,x/divisor):x;}));cache.set(id,rows);return rows;}
  const nodes=doc.nodes,parents=Array(nodes.length).fill(-1);nodes.forEach((n,i)=>(n.children??[]).forEach(c=>parents[c]=i));
  const rest=nodes.map(n=>({t:n.translation??[0,0,0],q:n.rotation??[0,0,0,1],s:n.scale??[1,1,1],m:n.matrix}));
  function pose(name,phase){const a=doc.animations.find(x=>x.name===name);if(!a)throw Error('Missing '+name);const duration=Math.max(...a.samplers.map(s=>accessor(s.input).at(-1)[0])),time=phase*duration,local=rest.map(x=>({...x}));for(const ch of a.channels){const s=a.samplers[ch.sampler],ts=accessor(s.input).map(x=>x[0]),vs=accessor(s.output);if(!['LINEAR','STEP',undefined].includes(s.interpolation))throw Error('Unsupported interpolation');let i=0;while(i<ts.length-2&&ts[i+1]<time)i++;let value;if(time<=ts[0])value=vs[0];else if(time>=ts.at(-1))value=vs.at(-1);else if(s.interpolation==='STEP')value=vs[i];else{const u=(time-ts[i])/(ts[i+1]-ts[i]);value=ch.target.path==='rotation'?slerp(vs[i],vs[i+1],u):lerp(vs[i],vs[i+1],u);}const k={translation:'t',rotation:'q',scale:'s'}[ch.target.path];if(!k)throw Error('Unsupported animated path');local[ch.target.node][k]=value;local[ch.target.node].m=undefined;}return local;}
  function world(local){const matrices=[],resolve=i=>matrices[i]??(matrices[i]=parents[i]<0?(local[i].m??compose(local[i].t,local[i].q,local[i].s)):multiply(resolve(parents[i]),local[i].m??compose(local[i].t,local[i].q,local[i].s)));nodes.forEach((_,i)=>resolve(i));return matrices;}
  return{doc,accessor,rest,pose,world,sha256:hash(bytes),file:path.resolve(file)};
}
const sources=[load(baselinePath),load(candidatePath)],base=sources[0],bind=base.world(base.rest),vertices={L:[],R:[]};
const skinFrames=[];
for(let ni=0;ni<base.doc.nodes.length;ni++){
  const node=base.doc.nodes[ni];if(node.mesh===undefined||node.skin===undefined)continue;
  const skin=base.doc.skins[node.skin],ib=skin.inverseBindMatrices===undefined?skin.joints.map(identity):base.accessor(skin.inverseBindMatrices);
  skinFrames.push({mesh_node:node.name,mesh_bind_global:bind[ni],skin_skeleton:skin.skeleton===undefined?null:base.doc.nodes[skin.skeleton].name,joint_roots:skin.joints.filter(j=>!skin.joints.some(p=>(base.doc.nodes[p].children??[]).includes(j))).map(j=>({name:base.doc.nodes[j].name,global:bind[j]}))});
  for(const[pi,p]of base.doc.meshes[node.mesh].primitives.entries()){
    const a=p.attributes,positions=base.accessor(a.POSITION),j0=base.accessor(a.JOINTS_0),w0=base.accessor(a.WEIGHTS_0),j1=a.JOINTS_1===undefined?null:base.accessor(a.JOINTS_1),w1=a.WEIGHTS_1===undefined?null:base.accessor(a.WEIGHTS_1);
    for(let vi=0;vi<positions.length;vi++){
      const rest=transform(bind[ni],positions[vi]);if(rest[1]>.30)continue;
      const joints=j0[vi].concat(j1?.[vi]??[]),weights=w0[vi].concat(w1?.[vi]??[]),influence={L:0,R:0},terms=[];
      joints.forEach((id,k)=>{if(weights[k]<=0)return;const bone=skin.joints[id],name=base.doc.nodes[bone].name;for(const side of['L','R'])if(name==='ankle'+side||name==='knee'+side)influence[side]+=weights[k];terms.push({bone:name,node:bone,weight:weights[k],local:transform(ib[id],positions[vi])});});
      const side=influence.L>influence.R?'L':'R';if(influence[side]<.5)continue;
      vertices[side].push({id:`${ni}:${pi}:${vi}`,rest,mesh:base.doc.meshes[node.mesh].name,mesh_node:node.name,primitive:pi,vertex:vi,terms});
    }
  }
}
// Merge duplicated seam vertices only when all local weighted terms are identical to float precision.
for(const side of['L','R']){const unique=new Map();for(const v of vertices[side]){const key=JSON.stringify(v.terms.map(t=>[t.bone,t.weight,...t.local]));if(!unique.has(key))unique.set(key,v);}vertices[side]=[...unique.values()];if(!vertices[side].length)throw Error('Empty shoe set');}
function y(v,world,names){let height=0;for(const t of v.terms){const m=world[names.get(t.bone)],p=t.local;height+=t.weight*(m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13]);}if(!Number.isFinite(height))throw Error('Nonfinite skin');return height;}
const mandatory={L:new Map(),R:new Map()},frames=[],namesBySource=sources.map(s=>new Map(s.doc.nodes.map((n,i)=>[n.name,i])));
function sample(sourceIndex,local,label){const world=sources[sourceIndex].world(local),names=namesBySource[sourceIndex],minimum={};for(const side of['L','R']){let best=null,value=Infinity;for(const v of vertices[side]){const h=y(v,world,names);if(h<value){value=h;best=v;}}mandatory[side].set(best.id,best);minimum[side]=value;}frames.push({sourceIndex,world,minimum,label});}
for(let si=0;si<sources.length;si++){
  const source=sources[si],idlePhases=[0,.25,.5,.75],idles=idlePhases.map(t=>source.pose('idle',t));
  for(const action of['walk','jog','sprint']){
    for(let k=0;k<120;k++)sample(si,source.pose(action,k/120),{type:'clip',action,phase:k/120});
    // 30 gait phases x 4 idle phases x 9 mixture weights cover both transition directions.
    for(let k=0;k<30;k++){
      const gait=source.pose(action,k/30);
      for(let ip=0;ip<idles.length;ip++)for(let b=0;b<=8;b++){
        const u=b/8,local=gait.map((a,i)=>a.m?{...a}:{t:lerp(idles[ip][i].t,a.t,u),q:slerp(idles[ip][i].q,a.q,u),s:lerp(idles[ip][i].s,a.s,u)});
        sample(si,local,{type:'idle_gait_blend',action,phase:k/30,idle_phase:idlePhases[ip],gait_weight:u});
      }
    }
  }
}
const selected={L:[],R:[]};
for(const side of['L','R']){
  const chosen=new Map(mandatory[side]),sole=vertices[side].filter(v=>v.rest[1]<.12);
  for(let i=0;i<16;i++){const a=i*Math.PI/8;let best=sole[0],projection=-Infinity;for(const v of sole){const p=v.rest[0]*Math.cos(a)+v.rest[2]*Math.sin(a);if(p>projection){projection=p;best=v;}}chosen.set(best.id,best);}
  const target=Math.max(96,chosen.size);
  while(chosen.size<target){let best=null,distance=-1;for(const v of sole){if(chosen.has(v.id))continue;let nearest=Infinity;for(const q of chosen.values()){const d=(v.rest[0]-q.rest[0])**2+(v.rest[2]-q.rest[2])**2+.3*(v.rest[1]-q.rest[1])**2;nearest=Math.min(nearest,d);}if(nearest>distance){distance=nearest;best=v;}}if(!best)break;chosen.set(best.id,best);}
  selected[side]=[...chosen.values()];
}
const coverage={L:{max_probe_overestimate:0,worst:null},R:{max_probe_overestimate:0,worst:null}};
for(const f of frames)for(const side of['L','R']){const sampled=Math.min(...selected[side].map(v=>y(v,f.world,namesBySource[f.sourceIndex]))),error=sampled-f.minimum[side];if(error>coverage[side].max_probe_overestimate){coverage[side]={max_probe_overestimate:error,worst:{source:f.sourceIndex,...f.label,all_vertices_min:f.minimum[side],probes_min:sampled}};}}
const points=Object.fromEntries(['L','R'].map(side=>[side,selected[side].map(v=>({
  id:v.id,source:{mesh:v.mesh,mesh_node:v.mesh_node,primitive:v.primitive,vertex:v.vertex},
  rest_global:v.rest,terms:v.terms.map(({bone,weight,local})=>({bone,weight,local}))
}))]));
const report={
  version:1,
  coordinate_contract:{
    units:'metres',axes:'glTF right-handed, Y up, character forward -Z',
    local_definition:'Each term.local is the original glTF inverseBindMatrix[joint] multiplied by the original mesh-local POSITION, with homogeneous w=1. Do not multiply by mesh or ankle rest again.',
    evaluation:'For each probe: p_skeleton = sum(weight * (Skeleton3D.get_bone_global_pose(find_bone(bone)) * Vector3(local))). Then p_world = skeleton.global_transform * p_skeleton. Compare world.y to the actual floor plane.',
    godot_mapping_status:'Algebraic joint-local mapping; not yet cross-validated in Godot for this payload. Validate several probes against GPU-baked vertices using provenance before enabling a runtime correction. Import basis/scale and skeleton wrapper must match; metadata includes GLB transforms.',
    normalization:'All nonzero original weights are retained; no renormalization or animated-X side reclassification.',
    scope:'Conservative finite sample set for floor-depth correction, not a foot orientation or exact continuous collision system.'
  },
  sources:sources.map(s=>({file:s.file,sha256:s.sha256})),skin_frames:skinFrames,
  sampling:{full_cycle_phases_per_gait:120,transition_gait_phases:30,transition_idle_phases:[0,.25,.5,.75],transition_gait_weights:[0,.125,.25,.375,.5,.625,.75,.875,1],both_transition_directions:'Same local-transform interpolation family, traversed in reverse.',sampled_poses:frames.length,includes_current_candidate_only:true},
  counts:Object.fromEntries(['L','R'].map(side=>[side,{unique_below_cuff_vertices:vertices[side].length,mandatory_lowest_vertices:mandatory[side].size,selected:selected[side].length}])),
  sampled_pose_coverage:coverage,points
};
fs.mkdirSync(path.dirname(path.resolve(outputPath)),{recursive:true});fs.writeFileSync(outputPath,JSON.stringify(report,null,2));
console.log(JSON.stringify({output:path.resolve(outputPath),sources:report.sources,sampling:report.sampling,counts:report.counts,coverage:report.sampled_pose_coverage,skin_frames:report.skin_frames},null,2));
