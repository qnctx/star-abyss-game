const r=require('./r2-integrated-browser/report.json');
for(const c of r.checks){
  if(c.path) console.log(c.name,JSON.stringify({first:c.path[0],last:c.path.at(-1),minZ:Math.min(...c.path.map(p=>p.z)),maxY:Math.max(...c.path.map(p=>p.y)),last15:c.path.slice(-15)}));
  else if(c.approach) console.log(c.name,JSON.stringify({opened:c.opened,npc:c.npc,first:c.approach[0],last:c.approach.at(-1),minDistance:Math.min(...c.approach.map(p=>p.distance)),minZ:Math.min(...c.approach.map(p=>p.z)),maxZ:Math.max(...c.approach.map(p=>p.z)),maxY:Math.max(...c.approach.map(p=>p.y)),last15:c.approach.slice(-15)}));
}
