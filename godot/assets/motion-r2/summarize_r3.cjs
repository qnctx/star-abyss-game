const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const report = JSON.parse(fs.readFileSync(path.join(root,'evidence/r3-live/report.json'),'utf8'));
const deltas = report.records.map(r=>r.delta);
const summary = {
  method: report.method,
  frames: report.frame_count,
  actual_delta_min: Math.min(...deltas),
  actual_delta_max: Math.max(...deltas),
  actual_delta_mean: deltas.reduce((a,b)=>a+b,0)/deltas.length,
  physics_seconds: report.records.at(-1).simulation_seconds,
  wall_seconds: report.records.at(-1).wall_seconds,
  time_scale: report.time_scale,
  bone_count: report.bone_count,
  failures: report.failures,
  pending_asset_requirements: report.pending_asset_requirements,
  cases: [...new Set(report.records.map(r=>r.case))].map(name=>{
    const rows=report.records.filter(r=>r.case===name);
    const drift=[];
    for(let i=1;i<rows.length;i++)for(const side of ['l','r']){
      if(rows[i]['planted_'+side]&&rows[i-1]['planted_'+side]&&rows[i]['ankle_'+side]){
        const a=rows[i]['ankle_'+side],b=rows[i-1]['ankle_'+side];
        drift.push(Math.hypot(...a.map((v,k)=>v-b[k])));
      }
    }
    return {name, frames:rows.length, clips:[...new Set(rows.map(r=>r.clip))], release_crossings:rows.at(-1).release_count, max_adjacent_planted_ankle_m:drift.length?Math.max(...drift):null};
  }),
};
fs.writeFileSync(path.join(root,'evidence/r3-live/summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
