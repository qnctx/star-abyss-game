import { WORLD, WALLS, PROP_SOLIDS, GATE, ROCK_FIELD, terrainHeight, insideWreck, rockSurfaceHeight } from './layout.mjs';
import { touchesRock } from './rocks.mjs';
import {VEHICLE_RIG} from './vehicle-rig.mjs';
import {physicalPropBlocked} from './foundation/physical-props.mjs';

export const CAMERA_RADIUS=.22;
export function cameraBlocked(point,gateOpen=false,radius=CAMERA_RADIUS) {
  if(physicalPropBlocked(point.x,point.z,point.y-radius,radius,radius*2))return true;
  if(point.y-radius<terrainHeight(point.x,point.z)+.025)return true;
  const hitsBox=(box,base)=>Math.abs(point.x-box.x)<box.w/2+radius&&Math.abs(point.z-box.z)<box.d/2+radius&&point.y+radius>base&&point.y-radius<base+box.h;
  if(WALLS.some(box=>hitsBox(box,0))||(!gateOpen&&hitsBox(GATE,0)))return true;
  if(hitsBox({x:0,z:-470,w:96,d:2,h:4.9},7))return true;
  if(PROP_SOLIDS.some(box=>hitsBox(box,terrainHeight(box.x,box.z))))return true;
  if(Math.abs(point.x)<48.5+radius&&Math.abs(point.z+632)<159+radius&&point.y+radius>11.9&&point.y-radius<13.3)return true;
  return ROCK_FIELD.query(point.x,point.z,radius).some(rock=>{
    if(!rock.solid||!touchesRock(rock,point.x,point.z,radius))return false;
    if(!rock.meshPositions)return point.y-radius<terrainHeight(rock.x,rock.z)+rock.height;
    let support=rockSurfaceHeight(rock,point.x,point.z);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;support=Math.max(support,rockSurfaceHeight(rock,point.x+Math.cos(a)*radius,point.z+Math.sin(a)*radius));}
    return point.y-radius<support+.025;
  });
}

// Sweep a sphere along the camera boom. Sampling is smaller than the narrowest wall.
export function sweepCamera(pivot,desired,gateOpen=false) {
  const dx=desired.x-pivot.x,dy=desired.y-pivot.y,dz=desired.z-pivot.z,distance=Math.hypot(dx,dy,dz);
  const steps=Math.max(1,Math.ceil(distance/.09));
  let safe={...pivot};
  for(let i=1;i<=steps;i++) {
    const t=i/steps,point={x:pivot.x+dx*t,y:pivot.y+dy*t,z:pivot.z+dz*t};
    if(cameraBlocked(point,gateOpen))return {position:safe,occluded:true};
    safe=point;
  }
  return {position:safe,occluded:false};
}

export function resolveCamera(player,mode='first',previous=null,delta=1/60,gateOpen=false) {
  const eye={x:player.x,y:(Number.isFinite(player.y)?player.y:terrainHeight(player.x,player.z))+(player.eyeHeight??WORLD.eyeHeight),z:player.z};
  const yaw=player.yaw||0,pitch=player.pitch||0;
  const prone=(player.proneAmount??(player.posture==='prone'?1:0))>0;
  if(mode==='first'&&prone){
    if(player.proneEye)Object.assign(eye,player.proneEye);
    else {const heading=player.heading??yaw;eye.x-=Math.sin(heading)*.72;eye.z-=Math.cos(heading)*.72;}
    eye.y=Math.max(eye.y,terrainHeight(eye.x,eye.z)+.18);
  }
  if(mode==='vehicle-first'){
    const heading=player.vehicleYaw??player.heading??0;
    eye.x+=Math.sin(heading)*VEHICLE_RIG.eye[2];eye.z+=Math.cos(heading)*VEHICLE_RIG.eye[2];
    eye.y=(Number.isFinite(player.y)?player.y:terrainHeight(player.x,player.z))+VEHICLE_RIG.eye[1]+VEHICLE_RIG.hullLift;
    if(player.vehicleEye)Object.assign(eye,player.vehicleEye);
  }
  const lean=mode==='vehicle-first'?0:(player.lean||0)*.3;
  const leanSweep=sweepCamera(eye,{x:eye.x+Math.cos(yaw)*lean,y:eye.y-Math.abs(lean)*.15,z:eye.z-Math.sin(yaw)*lean},gateOpen);
  Object.assign(eye,leanSweep.position);
  const forward={x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)};
  const target={x:eye.x+forward.x*12,y:eye.y+forward.y*12,z:eye.z+forward.z*12};
  if(mode!=='third'&&mode!=='vehicle')return {mode:mode==='vehicle-first'?mode:'first',position:eye,target,distance:0,occluded:false,avatarVisible:mode==='first'&&prone};
  const vehicle=mode==='vehicle',pivot={...eye,y:Math.max(eye.y+(vehicle?.5:-.25),(Number.isFinite(player.y)?player.y:terrainHeight(player.x,player.z))+.65)};
  const length=vehicle?6.5:prone?3.2:insideWreck(player.x,player.z)?2.7:4.3;
  const desired={x:pivot.x-forward.x*length+Math.cos(yaw)*(vehicle?0:.48),y:pivot.y-forward.y*length+(vehicle?1.2:prone?1.15:.65),z:pivot.z-forward.z*length-Math.sin(yaw)*(vehicle?0:.48)};
  const boom=sweepCamera(pivot,desired,gateOpen);
  let safe=boom;
  if(previous?.mode===mode&&Math.hypot(previous.position.x-pivot.x,previous.position.z-pivot.z)<12) {
    const alpha=1-Math.exp(-Math.max(0,delta)*15);
    const blended={x:previous.position.x+(boom.position.x-previous.position.x)*alpha,y:previous.position.y+(boom.position.y-previous.position.y)*alpha,z:previous.position.z+(boom.position.z-previous.position.z)*alpha};
    // A fast turn cannot smooth the camera through a corner or behind a closed door.
    safe=sweepCamera(pivot,blended,gateOpen);
  }
  const distance=Math.hypot(safe.position.x-pivot.x,safe.position.y-pivot.y,safe.position.z-pivot.z);
  return {mode,position:safe.position,target,distance,occluded:boom.occluded||safe.occluded,avatarVisible:distance>.85};
}
