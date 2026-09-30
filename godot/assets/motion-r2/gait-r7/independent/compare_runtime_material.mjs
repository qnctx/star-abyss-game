import fs from 'node:fs';
import path from 'node:path';
const [beforeFile,afterFile,outFile]=process.argv.slice(2);
if(!beforeFile||!afterFile||!outFile)throw Error('Usage: compare_runtime_material.mjs BEFORE_REPORT AFTER_REPORT OUTPUT');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const before=read(beforeFile),after=read(afterFile),bt=read(before.trace),at=read(after.trace);
const header=(r,t)=>({sha256:r.sha256,driver_sha256:r.driver_sha256,adapter_sha256:t.model_adapter_sha256,records:r.records,physics_delta_values:r.physics_delta_values,time_scale:r.time_scale,physical_duration:r.physical_duration,wall_span:r.wall_span,captured_pixels:r.captured_pixels,images_count:r.images_count,probe_error_m:r.max_recorded_probe_reconstruction_error_m,probe_coverage_gap_m:r.max_probe_coverage_gap_m});
const compact=w=>w?{side:w.side,vertex:w.source.vertex,clip:w.clip,start_tick:w.start_tick,end_tick:w.end_tick,duration_ms:w.duration*1000,excursion_mm:w.max_excursion_m*1000,y_range_mm:w.y_range_m.map(x=>x*1000),phase:[w.start_phase,w.end_phase]}:null;
const stage=r=>Object.fromEntries(Object.entries(r.stages).map(([k,v])=>[k,{min_y_mm:v.min_y*1000,steady_min_y_mm:v.steady_min_y===null?null:v.steady_min_y*1000,max_lift_mm:v.max_visual_lift*1000,worst_tick:v.worst.tick}]));
const short=r=>Object.fromEntries(Object.entries(r.short_window_diagnostics['0.004'].summary).map(([k,v])=>[k,{windows:v.windows,max_mm:v.max_excursion_mm,worst:compact(v.worst_window)}]));
const hdist=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
function pointWindow(t,side,vertex,start,end) {
 const index=t.fixed_material_points_provenance.findIndex(p=>p.side===side&&p.source.vertex===vertex);
 if(index<0)throw Error('Missing fixed material ID');
 const rs=t.records.filter(r=>r.tick>=start&&r.tick<=end),ps=rs.map(r=>r.fixed_material_points_world[index]);
 return {frames:rs.length,phase:[rs[0].phase,rs.at(-1).phase],clips:[...new Set(rs.map(r=>r.clip))],speed:[rs[0].speed,rs.at(-1).speed],max_excursion_mm:1000*Math.max(...ps.map(p=>hdist(ps[0],p))),y_range_mm:[1000*Math.min(...ps.map(p=>p[1])),1000*Math.max(...ps.map(p=>p[1]))]};
}
const windows=[['start','R',5770,30,32],['walk_to_jog','R',5780,214,215],['jog_to_sprint','L',45389,337,338],['walk_release','L',45427,157,164],['stop_walk','L',45427,460,463],['stop_idle','L',45419,469,490]];
const output={method:'Compare independent full-shoe reconstruction reports. Same-tick fixed-material comparisons include their height and changed phase: if a point is no longer near the support plane its displacement must not be labelled sliding. Stage-level worst near-support windows relocate after transition phase changes. No captured pixels or visual acceptance inferred.',before:header(before,bt),after:header(after,at),stages:{before:stage(before),after:stage(after)},tick341:{before:before.full_skin_samples.find(r=>r.tick===341),after:after.full_skin_samples.find(r=>r.tick===341)},near_support_short_windows_4mm:{before:short(before),after:short(after)},same_tick_material_windows:windows.map(([name,side,vertex,start,end])=>({name,side,vertex,ticks:[start,end],before:pointWindow(bt,side,vertex,start,end),after:pointWindow(at,side,vertex,start,end)}))};
fs.writeFileSync(path.resolve(outFile),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
