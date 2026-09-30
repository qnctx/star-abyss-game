// Independent, offline GLB audit. Does not import production animation code or run an engine.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
if(!args[0]||!args[1]) throw Error('Usage: node inspect_glb_gait.mjs INPUT.glb OUTPUT.json');
const glbPath = path.resolve(args[0]);
const outPath = path.resolve(args[1]);
const sampleCount=Number(args[2]??120);
if(!Number.isInteger(sampleCount)||sampleCount<120||sampleCount%2) throw Error('Sample intervals must be an even integer >= 120');
const bytes = fs.readFileSync(glbPath);
if (bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2) throw Error('Expected GLB 2');
let doc, bin;
for (let p = 12; p < bytes.length;) {
  const len = bytes.readUInt32LE(p), type = bytes.readUInt32LE(p + 4);
  if (type === 0x4e4f534a) doc = JSON.parse(bytes.toString('utf8', p + 8, p + 8 + len).trim());
  if (type === 0x004e4942) bin = bytes.subarray(p + 8, p + 8 + len);
  p += 8 + len;
}
const ident = () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
const sub = (a,b) => a.map((v,i) => v-b[i]);
const dot = (a,b) => a.reduce((v,x,i) => v+x*b[i],0);
const norm = a => Math.sqrt(dot(a,a));
const deg = r => r*180/Math.PI;
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
function mul(a,b) {
  const r = Array(16).fill(0);
  for(let c=0;c<4;c++) for(let row=0;row<4;row++) for(let k=0;k<4;k++) r[c*4+row]+=a[k*4+row]*b[c*4+k];
  return r;
}
function point(m,p) { return [0,1,2].map(i => m[i]*p[0]+m[4+i]*p[1]+m[8+i]*p[2]+m[12+i]); }
function compose(t=[0,0,0],q=[0,0,0,1],s=[1,1,1]) {
  const [x,y,z,w]=q, xx=x*x,yy=y*y,zz=z*z;
  return [(1-2*(yy+zz))*s[0],2*(x*y+z*w)*s[0],2*(x*z-y*w)*s[0],0,
    2*(x*y-z*w)*s[1],(1-2*(xx+zz))*s[1],2*(y*z+x*w)*s[1],0,
    2*(x*z+y*w)*s[2],2*(y*z-x*w)*s[2],(1-2*(xx+yy))*s[2],0,...t,1];
}
function slerp(a,b,u) {
  let d=dot(a,b); if(d<0){ b=b.map(x=>-x); d=-d; }
  if(d>.9995){const q=a.map((x,i)=>x+u*(b[i]-x));const l=norm(q);return q.map(x=>x/l);}
  const v=Math.acos(clamp(d,-1,1)),sn=Math.sin(v);
  return a.map((x,i)=>(Math.sin((1-u)*v)*x+Math.sin(u*v)*b[i])/sn);
}
const cache=new Map();
function accessor(id) {
  if(cache.has(id)) return cache.get(id);
  const a=doc.accessors[id]; if(a.sparse) throw Error('Sparse accessor unsupported');
  const v=doc.bufferViews[a.bufferView]; if(v.buffer!==0) throw Error('External buffers unsupported');
  const width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type];
  const format={5120:[1,'readInt8',127],5121:[1,'readUInt8',255],5122:[2,'readInt16LE',32767],5123:[2,'readUInt16LE',65535],5125:[4,'readUInt32LE',4294967295],5126:[4,'readFloatLE',1]}[a.componentType];
  if(!width||!format) throw Error('Unsupported accessor format');
  const [size,read,divisor]=format, stride=v.byteStride??width*size, base=(v.byteOffset??0)+(a.byteOffset??0);
  const rows=Array.from({length:a.count},(_,i)=>Array.from({length:width},(_,j)=>{
    const x=bin[read](base+i*stride+j*size); return a.normalized?Math.max(-1,x/divisor):x;
  }));
  cache.set(id,rows); return rows;
}
const nodes=doc.nodes, parent=Array(nodes.length).fill(-1);
nodes.forEach((n,i)=>(n.children??[]).forEach(c=>parent[c]=i));
function worldMatrices(animation,time) {
  const local=nodes.map(n=>({translation:n.translation,rotation:n.rotation,scale:n.scale,matrix:n.matrix}));
  for(const ch of animation?.channels??[]) {
    if(ch.target.path==='weights') throw Error('Morph animation unsupported');
    const sampler=animation.samplers[ch.sampler], ts=accessor(sampler.input).map(x=>x[0]), vs=accessor(sampler.output);
    if(!['LINEAR','STEP',undefined].includes(sampler.interpolation)) throw Error('Cubic animation unsupported');
    let i=0; while(i<ts.length-2 && ts[i+1]<time) i++;
    let value;
    if(time<=ts[0]) value=vs[0]; else if(time>=ts.at(-1)) value=vs.at(-1);
    else if(sampler.interpolation==='STEP') value=vs[i];
    else { const u=(time-ts[i])/(ts[i+1]-ts[i]); value=ch.target.path==='rotation'?slerp(vs[i],vs[i+1],u):vs[i].map((x,k)=>x+u*(vs[i+1][k]-x)); }
    local[ch.target.node]={...local[ch.target.node],[ch.target.path]:value,matrix:undefined};
  }
  const world=[];
  const resolve=i=>world[i]??(world[i]=parent[i]<0?(local[i].matrix??compose(local[i].translation,local[i].rotation,local[i].scale)):mul(resolve(parent[i]),local[i].matrix??compose(local[i].translation,local[i].rotation,local[i].scale)));
  nodes.forEach((_,i)=>resolve(i)); return world;
}
const bindWorld=worldMatrices(null,0), bones={};
for(const name of ['pelvis','hipL','kneeL','ankleL','hipR','kneeR','ankleR','shoulderL','elbowL','shoulderR','elbowR']) {
  const id=nodes.findIndex(n=>n.name===name); if(id<0) throw Error(`Missing bone ${name}`); bones[name]=id;
}
const footwear={L:[],R:[]};
for(let ni=0;ni<nodes.length;ni++) {
  const node=nodes[ni]; if(node.mesh===undefined||node.skin===undefined) continue;
  const skin=doc.skins[node.skin], ib=skin.inverseBindMatrices===undefined?skin.joints.map(ident):accessor(skin.inverseBindMatrices);
  for(const [pi,primitive] of doc.meshes[node.mesh].primitives.entries()) {
    const at=primitive.attributes, pos=accessor(at.POSITION), joints=accessor(at.JOINTS_0), weights=accessor(at.WEIGHTS_0);
    const joints1=at.JOINTS_1===undefined?null:accessor(at.JOINTS_1), weights1=at.WEIGHTS_1===undefined?null:accessor(at.WEIGHTS_1);
    for(let vi=0;vi<pos.length;vi++) {
      const rest=point(bindWorld[ni],pos[vi]); if(rest[1]>.30) continue;
      const j=joints[vi].concat(joints1?.[vi]??[]), w=weights[vi].concat(weights1?.[vi]??[]), influence={L:0,R:0};
      j.forEach((id,k)=>{ const name=nodes[skin.joints[id]].name; for(const side of ['L','R']) if(name==='ankle'+side||name==='knee'+side) influence[side]+=w[k]; });
      const side=influence.L>influence.R?'L':'R'; if(influence[side]<.5) continue;
      footwear[side].push({p:pos[vi],rest,node:ni,primitive:pi,vertex:vi,joints:j.map(id=>skin.joints[id]),ib:j.map(id=>ib[id]),weights:w});
    }
  }
}
function landmarks(vertices) {
  // Fixed material-point groups from the unposed shoe geometry; never classify by animated x.
  const sole=vertices.filter(v=>v.rest[1]<.09);
  const sorted=[...sole].sort((a,b)=>a.rest[2]-b.rest[2]), count=Math.max(1,Math.floor(sorted.length*.18));
  return {toe:sorted.slice(0,count),heel:sorted.slice(-count),soleCount:sole.length};
}
const marks={L:landmarks(footwear.L),R:landmarks(footwear.R)};
for(const side of ['L','R']) if(!footwear[side].length||!marks[side].toe.length||!marks[side].heel.length) throw Error(`No shoe material points for ${side}`);
function skinned(v,world) {
  const out=[0,0,0];
  for(let i=0;i<v.weights.length;i++) {const w=v.weights[i];if(!w)continue;const p=point(mul(world[v.joints[i]],v.ib[i]),v.p);for(let k=0;k<3;k++)out[k]+=w*p[k];}
  if(!out.every(Number.isFinite)) throw Error('Nonfinite skinned vertex');
  return out;
}
function avg(group,map) {return group.reduce((r,v)=>r.map((x,i)=>x+map.get(v)[i]/group.length),[0,0,0]);}
const summaries={},samples={};
for(const action of ['walk','jog','sprint']) {
  const animation=doc.animations.find(a=>a.name===action||a.name?.endsWith('/'+action)); if(!animation) throw Error(`Missing animation ${action}`);
  const duration=Math.max(...animation.samplers.map(s=>accessor(s.input).at(-1)[0]));
  const rows=[];
  for(let frame=0;frame<=sampleCount;frame++) {
    const phase=frame/sampleCount, world=worldMatrices(animation,duration*phase), get=n=>world[bones[n]].slice(12,15);
    const row={phase,pelvis:get('pelvis'),legs:{}};
    for(const side of ['L','R']) {
      const hip=get('hip'+side),knee=get('knee'+side),ankle=get('ankle'+side),upper=sub(knee,hip),lower=sub(ankle,knee);
      const skin=new Map(footwear[side].map(v=>[v,skinned(v,world)]));
      let lowest=null;
      for(const [v,p] of skin) if(!lowest||p[1]<lowest.position[1]) lowest={position:p,node:v.node,primitive:v.primitive,vertex:v.vertex};
      const toe=avg(marks[side].toe,skin),heel=avg(marks[side].heel,skin),axis=sub(toe,heel);
      row.legs[side]={hip,knee,ankle,thigh_deg:deg(Math.atan2(-upper[2],-upper[1])),knee_flex_deg:deg(Math.acos(clamp(dot(upper,lower)/(norm(upper)*norm(lower)),-1,1))),upper_length:norm(upper),lower_length:norm(lower),toe,heel,shoe_yaw_deg:deg(Math.atan2(axis[0],-axis[2])),lowest};
      if(!['thigh_deg','knee_flex_deg','shoe_yaw_deg'].every(k=>Number.isFinite(row.legs[side][k]))) throw Error('Nonfinite joint angle');
    }
    rows.push(row);
  }
  const range=values=>[Math.min(...values),Math.max(...values)];
  summaries[action]={duration,per_leg:Object.fromEntries(['L','R'].map(side=>[side,{
    thigh_deg:range(rows.map(r=>r.legs[side].thigh_deg)),knee_flex_deg:range(rows.map(r=>r.legs[side].knee_flex_deg)),
    shoe_yaw_deg:range(rows.map(r=>r.legs[side].shoe_yaw_deg)),min_shoe_y:Math.min(...rows.map(r=>r.legs[side].lowest.position[1])),
    upper_length:range(rows.map(r=>r.legs[side].upper_length)),lower_length:range(rows.map(r=>r.legs[side].lower_length)),
    highest_ankle:rows.reduce((best,r)=>r.legs[side].ankle[1]>best.legs[side].ankle[1]?r:best,rows[0]).phase,
    recovery_ankle_behind_hip:sub(rows.reduce((best,r)=>r.legs[side].ankle[1]>best.legs[side].ankle[1]?r:best,rows[0]).legs[side].ankle,rows.reduce((best,r)=>r.legs[side].ankle[1]>best.legs[side].ankle[1]?r:best,rows[0]).legs[side].hip)[2]
  }]))};
  const unique=rows.slice(0,-1), rmse=(key,shift)=>Math.sqrt(unique.reduce((sum,r,i)=>sum+(r.legs.L[key]-unique[(i+shift)%sampleCount].legs.R[key])**2,0)/sampleCount);
  const shifts=Array.from({length:sampleCount},(_,i)=>({phase:i/sampleCount,error:rmse('thigh_deg',i)})).sort((a,b)=>a.error-b.error);
  summaries[action].half_cycle={thigh_rmse_deg:rmse('thigh_deg',sampleCount/2),knee_rmse_deg:rmse('knee_flex_deg',sampleCount/2),best_thigh_shift:shifts[0]};
  summaries[action].actual_both_shoes_above_8mm_fraction=unique.filter(r=>r.legs.L.lowest.position[1]>.008&&r.legs.R.lowest.position[1]>.008).length/sampleCount;
  summaries[action].loop_closure={max_joint_position_delta:Math.max(...['L','R'].flatMap(s=>['hip','knee','ankle'].map(k=>norm(sub(rows[0].legs[s][k],rows.at(-1).legs[s][k]))))),max_shoe_heading_delta:Math.max(...['L','R'].map(s=>Math.abs(rows[0].legs[s].shoe_yaw_deg-rows.at(-1).legs[s].shoe_yaw_deg)))};
  samples[action]=rows;
}
const report={method:'Independent GLB LINEAR/STEP sampler with full blend-weight evaluation of below-cuff vertices. Fixed shoe material-point groups use rest geometry, not animated left/right x. Offline data do not include Godot runtime IK, transitions, physics, input or rendered acceptance. Shoe yaw from front/rear rest-z quantiles is diagnostic and requires visual corroboration.',source:glbPath,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),sample_intervals_per_cycle:sampleCount,footwear_vertices:Object.fromEntries(['L','R'].map(s=>[s,footwear[s].length])),landmark_counts:Object.fromEntries(['L','R'].map(s=>[s,{toe:marks[s].toe.length,heel:marks[s].heel.length,sole:marks[s].soleCount}])),summaries,samples};
fs.mkdirSync(path.dirname(outPath),{recursive:true});fs.writeFileSync(outPath,JSON.stringify(report,null,2));
console.log(JSON.stringify({report:outPath,sha256:report.sha256,footwear_vertices:report.footwear_vertices,landmark_counts:report.landmark_counts,summaries},null,2));
