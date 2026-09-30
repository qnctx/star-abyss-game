// Independent summary of captured actual Godot physics records; no engine launch.
import fs from 'node:fs';
import path from 'node:path';
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node inspect_runtime_trace.mjs TRACE.json REPORT.json');
const data=JSON.parse(fs.readFileSync(input,'utf8'));
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const norm=a=>Math.sqrt(dot(a,a));
const deg=x=>x*180/Math.PI;
const clamp=x=>Math.max(-1,Math.min(1,x));
const range=a=>[Math.min(...a),Math.max(...a)];
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
const correlation=(a,b)=>{const ma=mean(a),mb=mean(b),da=a.map(x=>x-ma),db=b.map(x=>x-mb);return dot(da,db)/Math.sqrt(dot(da,da)*dot(db,db));};
function angles(p,side) {
  const upper=sub(p['knee'+side],p['hip'+side]),lower=sub(p['ankle'+side],p['knee'+side]),arm=sub(p['elbow'+side],p['shoulder'+side]);
  return {thigh:deg(Math.atan2(-upper[2],-upper[1])),knee:deg(Math.acos(clamp(dot(upper,lower)/(norm(upper)*norm(lower))))),arm:deg(Math.atan2(-arm[2],-arm[1]))};
}
const stages={};
for(const stage of ['walk','jog','sprint']) {
  const records=data.records.filter(r=>r.stage===stage&&r.stage_age>.3);
  if(!records.length)throw Error(`No steady ${stage} records`);
  const result={steady_records:records.length,per_leg:{}};
  for(const side of ['L','R']) {
    const measured=records.map(r=>angles(r.runtime,side)),thigh=measured.map(a=>a.thigh),arm=measured.map(a=>a.arm);
    result.per_leg[side]={thigh_deg:range(thigh),knee_flex_deg:range(measured.map(a=>a.knee)),upper_arm_deg:range(arm),same_side_arm_thigh_correlation:correlation(thigh,arm),max_raw_runtime_joint_delta:Object.fromEntries(['hip','knee','ankle'].map(b=>[b,Math.max(...records.map(r=>norm(sub(r.raw[b+side],r.runtime[b+side]))))]))};
  }
  result.torso_lean_deg=range(records.map(r=>{const p=r.runtime,shoulder=p.shoulderL.map((v,i)=>(v+p.shoulderR[i])/2),up=sub(shoulder,p.pelvis);return deg(Math.atan2(-up[2],up[1]));}));
  stages[stage]=result;
}
const first=data.records[0],last=data.records.at(-1),seconds=last.seconds-first.seconds,wall=last.wall-first.wall;
const report={method:'Independent analysis of actual Godot physics trace supplied by capture probe. Bone positions after runtime IK and raw sampled clip are compared. Steady state excludes first 0.3 s of each gait. Rigid sole proxy values are intentionally not used as full-skin contact evidence. This does not itself establish human visual acceptance.',trace:path.resolve(input),view:data.view,glb_sha256:data.glb_sha256,driver_sha256:data.driver_sha256,time_scale:data.time_scale,records:data.records.length,physics_seconds:seconds,wall_seconds:wall,physics_to_wall_ratio:seconds/wall,delta_range:range(data.records.map(r=>r.delta)),stages};
fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
