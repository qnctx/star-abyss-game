import {terrainHeight,collidesAtHeight,WORLD} from './layout.mjs';

// Project tuning inspired by desktop tactical shooters; not PUBG's private values.
export const POSTURES=Object.freeze({stand:{eye:1.72,height:1.85,speed:1},crouch:{eye:1.05,height:1.3,speed:.52},prone:{eye:.38,height:.58,speed:.18}});
export function postureBlocked(player,posture,gateOpen=false,x=player.x,z=player.z){
  const p=POSTURES[posture]||POSTURES.stand,y=Number.isFinite(player.y)?player.y:terrainHeight(x,z);
  const heading=player.heading||0,reach=posture==='prone'?.7:0;
  return [-reach,0,reach].some(d=>{
    const px=x-Math.sin(heading)*d,pz=z-Math.cos(heading)*d;
    // Natural terrain rising a few centimetres beneath a long prone body is
    // support, not a wall. Raised rocks and solid structures still block it.
    let feet=Math.max(y,terrainHeight(px,pz));
    for(let i=0;i<8;i++)feet=Math.max(feet,terrainHeight(px+Math.cos(i*Math.PI/4)*WORLD.radius,pz+Math.sin(i*Math.PI/4)*WORLD.radius));
    return collidesAtHeight(px,pz,feet,gateOpen,WORLD.radius,p.height);
  });
}
export function setPosture(player,next,{airborne=false,mounted=false,gateOpen=false}={}){
  if(airborne||mounted||!POSTURES[next]||postureBlocked(player,next,gateOpen))return false;
  player.posture=next;return true;
}
export function updateTacticalControl(player,controls,dt,{mounted=false,airborne=false}={}){
  const posture=POSTURES[player.posture]||POSTURES.stand;
  const walking=!!controls.walk;
  player.spaceHoldTime=0;
  const sprint=mounted?!!controls.sprint:!!controls.sprint&&!walking&&(player.posture||'stand')==='stand'&&!controls.leanLeft&&!controls.leanRight;
  const leanTarget=mounted||airborne||player.posture==='prone'||sprint?0:Number(!!controls.leanRight)-Number(!!controls.leanLeft);
  const alpha=1-Math.exp(-Math.min(.05,Math.max(0,dt))*12);
  player.eyeHeight=(player.eyeHeight??1.72)+(posture.eye-(player.eyeHeight??1.72))*alpha;
  player.lean=(player.lean||0)+(leanTarget-(player.lean||0))*alpha;
  return {...controls,lift:!!controls.lift,tactical:true,walk:walking,sprint,posture:player.posture||'stand'};
}
