const fs=require('fs');
const edit=(p,f)=>fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')));
edit('playable/src/main.mjs',s=>s.replace('flying?globalToLocal(planetRuntime.position,planetRuntime.frame):{}','flying?planetRuntime.combatPose():{}'));
edit('playable/src/test-lab.mjs',s=>s.replace("const p=api.context().player;p.yaw=p.heading=Math.atan2(x-target.x,z-target.z);p.pitch=Math.atan2((target.y??terrainHeight(target.x,target.z))+1-(y+1.5),Math.hypot(x-target.x,z-target.z));", "const p=api.context().player,aim=planet.aimAtLocal({x:target.x,y:(target.y??terrainHeight(target.x,target.z))+1,z:target.z});p.yaw=p.heading=aim.yaw;p.pitch=aim.pitch;"));
