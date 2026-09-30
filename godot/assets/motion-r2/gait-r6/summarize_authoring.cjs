const fs=require('fs');const data=JSON.parse(fs.readFileSync('godot/assets/motion-r2/gait-r6/authoring-report.json','utf8'));
for(const [name,rows] of Object.entries(data.samples)){
 console.log(name);
 for(const row of rows.filter((r,i)=>i%Math.max(1,Math.round(rows.length/8))===0||r.max_ik_clamp_m>.01)){
  const d=row.sides.L;console.log(JSON.stringify({t:row.phase,clamp:row.max_ik_clamp_m,initial:[row.sides.L.initial_clamp_m,row.sides.R.initial_clamp_m],phase:d.phase,hip:d.hip,knee:d.knee,ankle:d.ankle,bend:d.knee_flexion_deg,thigh:d.thigh_forward_deg,height:d.height,desired:d.clearance,dy:d.correction_y_m,yaw:d.yaw_deg,ankle_yaw:d.ankle_yaw_deg}));
 }
}
