// Deterministic CPU-only microbenchmark; excludes rendering and GPU work.
// Run: node playable/tests/gait-benchmark.mjs
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {createGait,updateGait,gaitView} from '../src/gait.mjs';
import {sampleClip,forwardPose,directionalPose} from '../src/authored-motion.mjs';
const ground=(x,z)=>({height:0,surface:x<0?'gravel':'dust',indoor:false});
function run(mode,count,capture=false){
  const player={x:0,y:0,z:0,heading:0,yaw:0},state=createGait(player,ground),frames=[],contacts=[];
  const dt=1/120;
  for(let i=0;i<count;i++){
    const modeIndex=mode==='mixed'?Math.floor(i/120)%8:mode;
    const direction=modeIndex===1?[0,1]:modeIndex===2?[-1,0]:modeIndex===3?[1,0]:[0,-1];
    const speed=modeIndex===4?0:modeIndex===5?8.6:modeIndex===6?12:modeIndex===7?24:2.4;
    player.x+=direction[0]*speed*dt;player.z+=direction[1]*speed*dt;player.y=modeIndex===6?1:0;player.yaw+=.003;
    const events=updateGait(state,{player,dt,grounded:modeIndex!==6,mounted:modeIndex===7,sampleGround:ground});
    if(capture){contacts.push(...events);if(i%30===0)frames.push(gaitView(state));}
  }
  return{frames,contacts};
}
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value,(_,v)=>typeof v==='number'?Math.round(v*1e8)/1e8:v)).digest('hex');
export function gaitBaselineFingerprint(){return fingerprint(run('mixed',1920,true));}
export function poseBaselineFingerprint(){
  const poses=[];
  for(const style of [{walk:1,jog:0,sprint:0},{walk:0,jog:1,sprint:0},{walk:.2,jog:.5,sprint:.3}])for(const direction of [{forward:1,backward:0,left:0,right:0},{forward:0,backward:1,left:0,right:0},{forward:0,backward:0,left:.4,right:.6}])for(let i=0;i<80;i++){
    const p=directionalPose(style,i/80,direction),fk=forwardPose(p);
    poses.push({position:p.position,rotations:p.rotations.map(q=>q.toArray()),feet:fk.feet.map(f=>({sole:f.sole.toArray(),contact:f.contact.toArray()}))});
  }
  return fingerprint(poses);
}
const report=process.argv.includes('--fingerprint');
if(report)console.log(JSON.stringify({gait:gaitBaselineFingerprint(),poses:poseBaselineFingerprint()}));
else if(import.meta.url.endsWith(process.argv[1]?.replaceAll('\\','/'))){
  const count=6000,batches=7,rows=[];
  for(const [name,work]of [
    ['sampleClip',()=>{for(let i=0;i<count;i++)sampleClip('jog',i/317);}],
    ['forward gait',()=>run(0,count)],['lateral gait',()=>run(2,count)],
    ['idle gait',()=>run(4,count)],['flight gait',()=>run(6,count)],['mixed gait',()=>run('mixed',count)]
  ]){
    work();const times=[];
    for(let i=0;i<batches;i++){const start=performance.now();work();times.push(performance.now()-start);}
    times.sort((a,b)=>a-b);rows.push({name,calls:count,medianMs:+times[3].toFixed(3),usPerCall:+(times[3]*1000/count).toFixed(3),minMs:+times[0].toFixed(3),maxMs:+times.at(-1).toFixed(3)});
  }
  console.log(JSON.stringify({node:process.version,rows}));
}
