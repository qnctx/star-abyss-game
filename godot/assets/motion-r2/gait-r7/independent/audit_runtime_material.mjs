// Reconstruct shoe skinning from original GLB attributes and actual Godot poses.
// No engine or production modules are loaded. Sliding statistics keep material IDs fixed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const [traceFile,glbFile,outFile]=process.argv.slice(2);
if(!traceFile||!glbFile||!outFile) throw Error('Usage: audit_runtime_material.mjs TRACE GLB OUTPUT');
const trace=JSON.parse(fs.readFileSync(traceFile,'utf8'));
const bytes=fs.readFileSync(glbFile),hash=crypto.createHash('sha256').update(bytes).digest('hex');
if(trace.glb_sha256!==hash) throw Error('Trace/GLB hash mismatch');
let doc,bin;
for(let p=12;p<bytes.length;) {const n=bytes.readUInt32LE(p),type=bytes.readUInt32LE(p+4);if(type===0x4e4f534a)doc=JSON.parse(bytes.toString('utf8',p+8,p+8+n).trim());if(type===0x004e4942)bin=bytes.subarray(p+8,p+8+n);p+=8+n;}
const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const mul=(a,b)=>Array.from({length:16},(_,i)=>{const c=Math.floor(i/4),r=i%4;return a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3]});
const p16=(m,p)=>[0,1,2].map(i=>m[i]*p[0]+m[4+i]*p[1]+m[8+i]*p[2]+m[12+i]);
const p12=(m,p)=>[0,1,2].map(i=>m[i]*p[0]+m[3+i]*p[1]+m[6+i]*p[2]+m[9+i]);
function trs(n) {
 if(n.matrix)return n.matrix;
 const [x,y,z,w]=n.rotation??[0,0,0,1],[a,b,c]=n.scale??[1,1,1],t=n.translation??[0,0,0];
 return [(1-2*(y*y+z*z))*a,2*(x*y+z*w)*a,2*(x*z-y*w)*a,0,2*(x*y-z*w)*b,(1-2*(x*x+z*z))*b,2*(y*z+x*w)*b,0,2*(x*z+y*w)*c,2*(y*z-x*w)*c,(1-2*(x*x+y*y))*c,0,...t,1];
}
const cache=new Map();
function acc(id) {
 if(cache.has(id))return cache.get(id);
 const a=doc.accessors[id];if(a.sparse)throw Error('Sparse accessor unsupported');
 const v=doc.bufferViews[a.bufferView],width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type];
 const [size,read,div]={5120:[1,'readInt8',127],5121:[1,'readUInt8',255],5122:[2,'readInt16LE',32767],5123:[2,'readUInt16LE',65535],5125:[4,'readUInt32LE',4294967295],5126:[4,'readFloatLE',1]}[a.componentType];
 const base=(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??size*width;
 const rows=Array.from({length:a.count},(_,i)=>Array.from({length:width},(_,j)=>{const x=bin[read](base+i*stride+j*size);return a.normalized?Math.max(-1,x/div):x}));cache.set(id,rows);return rows;
}
const parent=Array(doc.nodes.length).fill(-1),rest=[];
doc.nodes.forEach((n,i)=>(n.children??[]).forEach(j=>parent[j]=i));
const restOf=i=>rest[i]??(rest[i]=parent[i]<0?trs(doc.nodes[i]):mul(restOf(parent[i]),trs(doc.nodes[i])));
const first=trace.records[0],boneNames=first.bone_names;
const vertices=[],bySource=new Map();
for(const [ni,node] of doc.nodes.entries()) {
 if(node.mesh===undefined||node.skin===undefined)continue;
 const skin=doc.skins[node.skin],ib=skin.inverseBindMatrices===undefined?skin.joints.map(()=>I):acc(skin.inverseBindMatrices);
 for(const [pi,primitive] of doc.meshes[node.mesh].primitives.entries()) {
  const at=primitive.attributes,positions=acc(at.POSITION),j0=acc(at.JOINTS_0),w0=acc(at.WEIGHTS_0),j1=at.JOINTS_1===undefined?null:acc(at.JOINTS_1),w1=at.WEIGHTS_1===undefined?null:acc(at.WEIGHTS_1);
  for(let vi=0;vi<positions.length;vi++) {
   const pos=positions[vi],bindPosition=p16(restOf(ni),pos);if(bindPosition[1]>.30)continue;
   const js=j0[vi].concat(j1?.[vi]??[]),ws=w0[vi].concat(w1?.[vi]??[]),inf={L:0,R:0};
   js.forEach((j,k)=>{for(const s of ['L','R'])if(['knee'+s,'ankle'+s].includes(doc.nodes[skin.joints[j]].name))inf[s]+=ws[k]});
   const side=inf.L>inf.R?'L':'R';if(inf[side]<.5)continue;
   const terms=[];
   js.forEach((j,k)=>{if(!ws[k])return;const name=doc.nodes[skin.joints[j]].name,bone=boneNames.indexOf(name);if(bone<0)throw Error('Missing pose bone '+name);const p=p16(ib[j],pos);terms.push({bone,weight:ws[k],local:p});});
   const key=node.name+':'+pi+':'+vi,v={key,side,source:{mesh_node:node.name,primitive:pi,vertex:vi},terms};
   bySource.set(key,vertices.length);vertices.push(v);
  }
 }
}
const provenance=trace.fixed_material_points_provenance;
if(!provenance?.length)throw Error('No fixed material provenance');
const probes=provenance.map(p=>{const i=bySource.get(p.source.mesh_node+':'+p.source.primitive+':'+p.source.vertex);if(i===undefined)throw Error('Probe not in reconstructed shoe set');return i});
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
function skin(v,r) {
 const p=[0,0,0];
 for(const term of v.terms) {const q=p12(r.bone_global_poses[term.bone],term.local);for(let k=0;k<3;k++)p[k]+=q[k]*term.weight;}
 return p12(r.rig_transform,p);
}
let maxProbeError=0,worstProbe=null,prev=null,maxProbeCoverageGap=0,worstProbeCoverage=null;
const stages={},fullSamples=[],computed=[];
for(const r of trace.records) {
 if(JSON.stringify(r.bone_names)!==JSON.stringify(boneNames))throw Error('Bone order changes');
 if(prev&&(r.tick!==prev.tick+1||r.physics_frame!==prev.physics_frame+1))throw Error('Nonconsecutive physics records');
 if(!r.in_physics)throw Error('Record outside physics');
 if(r.fixed_material_points_world.length!==probes.length)throw Error('Probe count mismatch');
 prev=r;
 const positions=vertices.map(v=>skin(v,r));
 const mins={L:{y:Infinity},R:{y:Infinity}};
 for(let i=0;i<positions.length;i++){const v=vertices[i],p=positions[i];if(p[1]<mins[v.side].y)mins[v.side]={y:p[1],source:v.source,position:p};}
 const ps=probes.map((vi,i)=>{const p=positions[vi],error=dist(p,r.fixed_material_points_world[i]);if(error>maxProbeError){maxProbeError=error;worstProbe={tick:r.tick,index:i,source:vertices[vi].source}}return p});
 computed.push({record:r,points:ps});
 const probeMinima=Object.fromEntries(['L','R'].map(side=>[side,Math.min(...ps.filter((_,i)=>provenance[i].side===side).map(p=>p[1]))]));
 for(const side of ['L','R']){const gap=probeMinima[side]-mins[side].y;if(gap>maxProbeCoverageGap){maxProbeCoverageGap=gap;worstProbeCoverage={tick:r.tick,stage:r.stage,phase:r.phase,side,probe_min:probeMinima[side],full_shoe_min:mins[side].y,source:mins[side].source};}}
 const item={tick:r.tick,seconds:r.seconds,phase:r.phase,clip:r.clip,stage:r.stage,stage_age:r.stage_age,visual_lift:r.visual_lift,minima:mins,probe_minima:probeMinima};
 fullSamples.push(item);
 const st=stages[r.stage]??(stages[r.stage]={records:0,min_y:Infinity,steady_min_y:Infinity,max_visual_lift:0,first_tick:r.tick,last_tick:r.tick});
 st.records++;st.last_tick=r.tick;st.max_visual_lift=Math.max(st.max_visual_lift,r.visual_lift);
 const y=Math.min(mins.L.y,mins.R.y);if(y<st.min_y){st.min_y=y;st.worst=item;}if(r.stage_age>.30&&r.clip===r.stage)st.steady_min_y=Math.min(st.steady_min_y,y);
}
if(maxProbeError>.0001)throw Error('Independent GLB to Godot reconstruction differs by > 0.1 mm; space/provenance invalid: '+maxProbeError);
const floor=trace.support_plane_y??trace.floor_plane_y??0,sliding={},shortSliding={};
const horizontal=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const quantile=(xs,q)=>{const a=[...xs].sort((a,b)=>a-b);return a.length?a[Math.round((a.length-1)*q)]:null;};
for(const mode of ['steady_50ms','all_stages_16ms'])for(const threshold of [.002,.004,.008]) {
 const windows=[];
 for(let pi=0;pi<probes.length;pi++) {
  let seq=[];
  const finish=()=>{
   if(seq.length>=(mode==='steady_50ms'?4:2)&&seq.at(-1).record.seconds-seq[0].record.seconds>=(mode==='steady_50ms'?.05:1/60)-1e-8) {
    const a=seq[0],b=seq.at(-1),duration=b.record.seconds-a.record.seconds;
    const excursions=seq.map(s=>horizontal(s.points[pi],a.points[pi]));
    let travel=0;for(let i=1;i<seq.length;i++)travel+=horizontal(seq[i].points[pi],seq[i-1].points[pi]);
    windows.push({side:provenance[pi].side,id:provenance[pi].id,source:provenance[pi].source,stage:a.record.stage,clip:a.record.clip,start_tick:a.record.tick,end_tick:b.record.tick,start_phase:a.record.phase,end_phase:b.record.phase,duration,frames:seq.length,net_horizontal_m:horizontal(a.points[pi],b.points[pi]),max_excursion_m:Math.max(...excursions),path_length_m:travel,mean_path_speed_m_s:travel/duration,y_range_m:[Math.min(...seq.map(s=>s.points[pi][1])),Math.max(...seq.map(s=>s.points[pi][1]))]});
   }
   seq=[];
  };
  for(const s of computed) {
   const r=s.record,y=s.points[pi][1],stable=['walk','jog','sprint'].includes(r.stage)&&r.stage===r.clip&&r.stage_age>.30,ok=(mode==='all_stages_16ms'||stable)&&y>=floor-.003&&y<=floor+threshold;
   if(seq.length&&(seq.at(-1).record.stage!==r.stage||seq.at(-1).record.clip!==r.clip))finish();
   if(ok)seq.push(s);else finish();
  }
  finish();
 }
 const summary={};
 for(const gait of (mode==='steady_50ms'?['walk','jog','sprint']:['idle','walk','jog','sprint','stop']))for(const side of ['L','R']) {
  const ws=windows.filter(w=>w.stage===gait&&w.side===side);
  summary[gait+'_'+side]={windows:ws.length,distinct_material_ids:new Set(ws.map(w=>w.id)).size,max_excursion_mm:ws.length?1000*Math.max(...ws.map(w=>w.max_excursion_m)):null,median_excursion_mm:ws.length?1000*quantile(ws.map(w=>w.max_excursion_m),.5):null,p95_excursion_mm:ws.length?1000*quantile(ws.map(w=>w.max_excursion_m),.95):null,longest_window:[...ws].sort((a,b)=>b.duration-a.duration)[0]??null,worst_window:[...ws].sort((a,b)=>b.max_excursion_m-a.max_excursion_m)[0]??null};
 }
 (mode==='steady_50ms'?sliding:shortSliding)[String(threshold)]={summary,windows};
}
const output={method:'Independent original GLB mixed-weight shoe reconstruction using recorded actual Godot bone global poses then rig world transform. Fixed rest classification and material IDs; no per-frame lowest-point substitution for sliding. Near-support windows require the same point within [-3 mm, threshold] relative to support_plane_y (not the separately offset display floor). Main sliding windows require >= 4 records / >= 50 ms and exclude first 0.30 s of each stage. The separate short-window diagnostic includes start/stop/all stages with >= 2 records / >= 16.7 ms. These height-gated windows measure material displacement, not collision forces or a blanket no-slip pass; heel/toe rolling can move near-floor points. Finite trace samples do not prove continuous all-frame extrema. No engine was launched by this auditor.',trace:path.resolve(traceFile),asset:path.resolve(glbFile),sha256:hash,driver_sha256:trace.driver_sha256,captured_pixels:trace.captured_pixels??null,images_count:trace.images.length,support_plane_y:floor,display_floor_plane_y:trace.floor_plane_y??null,records:trace.records.length,physics_delta_values:[...new Set(trace.records.map(r=>r.delta))],time_scale:trace.time_scale,physical_duration:trace.records.reduce((n,r)=>n+r.delta,0),wall_span:trace.records.at(-1).wall-first.wall,shoe_vertex_counts:Object.fromEntries(['L','R'].map(s=>[s,vertices.filter(v=>v.side===s).length])),probe_count:probes.length,max_recorded_probe_reconstruction_error_m:maxProbeError,worst_probe:worstProbe,max_probe_coverage_gap_m:maxProbeCoverageGap,worst_probe_coverage:worstProbeCoverage,stages,sliding,short_window_diagnostics:shortSliding,full_skin_samples:fullSamples};
fs.writeFileSync(path.resolve(outFile),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({output:path.resolve(outFile),records:output.records,probe_error_m:maxProbeError,stages,sliding_4mm:sliding['0.004'].summary},null,2));
