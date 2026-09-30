// Independent event descriptors from the fully skinned offline audit samples.
// These identify comparison candidates, not visual acceptance or exact contact physics.
import fs from 'node:fs';
import path from 'node:path';
const [beforeFile,afterFile,outFile]=process.argv.slice(2);
if(!beforeFile||!afterFile||!outFile) throw Error('Usage: derive_events.mjs BEFORE_AUDIT AFTER_AUDIT OUTPUT');
const definitions={walk:{stance:.60,phases:[0,.10,.30,.50,.60,.68,.78,.90]},jog:{stance:.22,phases:[0,.08,.22,.32,.43,.55,.67,.78,.91]},sprint:{stance:.20,phases:[0,.08,.20,.30,.40,.52,.65,.78,.91]}};
const round=x=>Math.round(x*1e6)/1e6;
const minimum=(rs,f)=>rs.reduce((a,b)=>f(b)<f(a)?b:a);
const maximum=(rs,f)=>rs.reduce((a,b)=>f(b)>f(a)?b:a);
function derive(file) {
 const source=JSON.parse(fs.readFileSync(file,'utf8'));
 const out={sha256:source.sha256,sample_intervals:source.sample_intervals_per_cycle,gaits:{}};
 for(const [gait,def] of Object.entries(definitions)) {
  out.gaits[gait]={};
  for(const side of ['L','R']) {
   const rows=source.samples[gait].slice(0,-1).map(r=>({phase:round((r.phase+(side==='L'?0:.5))%1),global_phase:r.phase,leg:r.legs[side],pelvis:r.pelvis})).sort((a,b)=>a.phase-b.phase);
   const y=r=>r.leg.lowest.position[1];
   const d=r=>({leg_phase:r.phase,global_phase:r.global_phase,thigh_deg:r.leg.thigh_deg,knee_flex_deg:r.leg.knee_flex_deg,sole_min_mm:1000*y(r),ankle_height_mm:1000*r.leg.ankle[1],ankle_behind_hip_mm:1000*(r.leg.ankle[2]-r.leg.hip[2]),heel_minus_toe_mm:1000*(r.leg.heel[1]-r.leg.toe[1]),shoe_yaw_deg:r.leg.shoe_yaw_deg,lowest_vertex:r.leg.lowest});
   const lowTransitions=threshold=>rows.flatMap((r,i)=>{
    const previous=rows[(i+rows.length-1)%rows.length];
    if((y(r)<=threshold)===(y(previous)<=threshold)) return [];
    return [{kind:y(r)<=threshold?'enters_near_floor':'leaves_near_floor',...d(r)}];
   });
   const events={};
   events.loading_knee_peak=d(maximum(rows.filter(r=>r.phase<=.18),r=>r.leg.knee_flex_deg));
   events.rear_thigh_peak=d(minimum(rows.filter(r=>r.phase<.70),r=>r.leg.thigh_deg));
   events.rear_recovery_ankle_peak=d(maximum(rows.filter(r=>r.phase>.20&&r.phase<.85&&r.leg.ankle[2]>r.leg.hip[2]),r=>r.leg.ankle[1]));
   events.swing_knee_peak=d(maximum(rows.filter(r=>r.phase>.20&&r.phase<.95),r=>r.leg.knee_flex_deg));
   const air=rows.filter(r=>r.phase>.30&&r.phase<.95&&y(r)>.008);
   events.ankle_pass_nearest_hip_plane=d(minimum(air,r=>Math.abs(r.leg.ankle[2]-r.leg.hip[2])));
   events.forward_thigh_peak=d(maximum(rows,r=>r.leg.thigh_deg));
   out.gaits[gait][side]={events,near_floor_transitions_4mm:lowTransitions(.004),near_floor_transitions_8mm:lowTransitions(.008),negative_sole_samples:rows.filter(r=>y(r)<0).map(d),authored_phase_observations:def.phases.map(p=>d(minimum(rows,r=>Math.min(Math.abs(r.phase-p),1-Math.abs(r.phase-p)))))};
  }
 }
 return out;
}
const result={method:'Events independently located from measured hip/knee/ankle and full shoe geometry at 240 phase intervals. Contact bands use 4/8 mm thresholds, not a declaration of exact physical impact. A measured maximum can differ from an authored phase target. Negative samples are raw GLB geometry without runtime floor lift. R6/R7 motion naturalness and material-point world sliding require actual runtime evidence.',before:derive(beforeFile),candidate:derive(afterFile)};
fs.writeFileSync(path.resolve(outFile),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({output:path.resolve(outFile),sha256:result.candidate.sha256,summary:Object.fromEntries(Object.entries(result.candidate.gaits).map(([g,legs])=>[g,Object.fromEntries(Object.entries(legs).map(([s,data])=>[s,{negative_samples:data.negative_sole_samples.map(r=>({phase:r.leg_phase,y_mm:r.sole_min_mm})),events:Object.fromEntries(Object.entries(data.events).map(([e,r])=>[e,{phase:r.leg_phase,thigh:r.thigh_deg,knee:r.knee_flex_deg}]))}]))]))},null,2));
