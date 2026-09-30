// Independent analysis of the supplied Godot GPU-baked full-mesh samples.
import fs from 'node:fs';
import path from 'node:path';
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node inspect_skin_evidence.mjs SKIN.json REPORT.json');
const data=JSON.parse(fs.readFileSync(input,'utf8')),stages={};
for(const r of data.samples){
  if(!Number.isFinite(r.min_y)||!Number.isFinite(r.visual_lift))throw Error('Nonfinite sample');
  if(!stages[r.stage])stages[r.stage]={samples:0,min_y:Infinity,max_visual_lift:0,max_active_probe_error:0,active_probe_samples:0};
  const s=stages[r.stage];s.samples++;s.min_y=Math.min(s.min_y,r.min_y);s.max_visual_lift=Math.max(s.max_visual_lift,r.visual_lift);
  const active=['walk','jog','sprint'].includes(r.stage)||r.visual_lift>0;
  if(active){const error=Math.abs(r.probe_minimum+r.visual_lift-r.min_y);s.active_probe_samples++;s.max_active_probe_error=Math.max(s.max_active_probe_error,error);}
}
const report={method:'Independent arithmetic recheck of supplied GPU-baked full-mesh records. Compares active probe minimum plus model lift against all-mesh minimum. Idle beyond the correction tail is excluded from the probe match because its probe field may be stale. This is not an independent engine execution and not continuous coverage between GPU samples.',source:path.resolve(input),glb_sha256:data.glb_sha256,driver_sha256:data.driver_sha256,time_scale:data.time_scale,physics_frames:data.physics_frames,gpu_samples:data.samples.length,vertex_counts:[...new Set(data.samples.map(r=>r.skinned_vertex_count))],stages,max_active_probe_error:Math.max(...Object.values(stages).map(s=>s.max_active_probe_error)),max_visual_lift_all_physics:Math.max(...data.records.map(r=>r.visual_lift)),max_gpu_physics_gap:Math.max(...data.samples.slice(1).map((r,i)=>r.seconds-data.samples[i].seconds)),reported_stage_minima_match:Object.entries(stages).every(([k,v])=>Math.abs(v.min_y-data.stage_min_y[k])<1e-10)};
fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
