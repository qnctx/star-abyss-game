// Full-body clip playback drives locomotion. Contact/terrain correction is a
// bounded layer on top of FK, never an independent procedural walking cycle.
import * as THREE from 'three';
import {CLIP_INFO,motionStyle,directionalPose,directionalStrideScale,restingPose,blendPose,forwardFeet,clipSupport} from './authored-motion.mjs';
import {crouchPose,pronePose,proneTransitionPose} from './tactical-pose.mjs';
const clamp=THREE.MathUtils.clamp, mix=THREE.MathUtils.lerp;
const finite=(n,f=0)=>Number.isFinite(n)?n:f;
const delta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const position=p=>({x:finite(p.x),y:finite(p.y),z:finite(p.z),yaw:finite(p.yaw),heading:finite(p.heading,finite(p.yaw))});
const wrap=n=>((n%1)+1)%1;
const DIRECTIONS=['forward','backward','left','right'];
function groundAt(sample,x,z,y){const hit=sample?.(x,z)||{};return{height:finite(hit.height,y),surface:hit.surface||'dust',indoor:!!hit.indoor,blocked:!!hit.blocked};}
function encode(pose){return{position:[...pose.position],rotations:pose.rotations.map(q=>q.toArray())};}
function directionView(dx,dz,yaw){
  const x=dx*Math.cos(yaw)-dz*Math.sin(yaw),z=-dx*Math.sin(yaw)-dz*Math.cos(yaw),total=Math.abs(x)+Math.abs(z);
  return total>1e-8?{forward:Math.max(0,z)/total,backward:Math.max(0,-z)/total,left:Math.max(0,-x)/total,right:Math.max(0,x)/total}:{forward:1,backward:0,left:0,right:0};
}
export function createGait(player,sampleGround){
  const p=position(player),state={player:p,facing:p.heading,phase:0,idlePhase:0,speed:0,weight:0,runBlend:0,walkBlend:1,jogBlend:0,sprintBlend:0,gaitMode:'walk',
    direction:{forward:1,backward:0,left:0,right:0},poseDirection:{forward:1,backward:0,left:0,right:0},grounded:true,mounted:false,airTime:0,impactSpeed:0,stepCount:0,safetyCorrections:0,moving:false,
    transition:'idle',turningInPlace:false,sampleGround,feet:[],body:{offsetX:0,offsetY:0,offsetZ:0,roll:0,yaw:0},pose:encode(restingPose('idle'))};
  resolveFeet(state,restingPose('idle'),p,sampleGround,[],true);
  return state;
}
function resolveFeet(state,pose,p,sample,events,reset=false){
  const cos=Math.cos(state.facing),sin=Math.sin(state.facing),style={walk:state.walkBlend,jog:state.jogBlend,sprint:state.sprintBlend};
  const world=v=>({x:p.x+v.x*cos+v.z*sin,y:p.y+v.y,z:p.z-v.x*sin+v.z*cos});
  const canSupport=state.grounded&&!state.mounted&&(state.proneBlend||0)<.02;
  const support=[canSupport&&(state.weight<.15||clipSupport(style,state.phase,-1)),canSupport&&(state.weight<.15||clipSupport(style,state.phase,1))];
  const fk=forwardFeet(pose);
  // Adapt the root to the supporting surface before the tiny leg correction;
  // do not stretch an almost-straight knee to reach a lower floor.
  if(canSupport){
    let lower=0;
    fk.feet.forEach((foot,i)=>{
      if(!support[i])return;
      const raw=world(foot.contact),hit=groundAt(sample,raw.x,raw.z,p.y);
      if(!hit.blocked&&Math.abs(hit.height-p.y)<.34)lower=Math.max(lower,raw.y-hit.height);
    });
    const lowering=clamp(lower,0,.12);
    pose.position[1]-=lowering;
    // Only the root translation changed: rotations and local limb geometry
    // are identical, so shift contacts instead of evaluating the rig again.
    if(lowering)for(const foot of fk.feet){foot.sole.y-=lowering;foot.contact.y-=lowering;foot.ankle.y-=lowering;}
  }
  const feet=fk.feet.map((fkFoot,i)=>{
    const raw=world(fkFoot.contact),sole=world(fkFoot.sole),prior=state.feet[i],hit=groundAt(sample,raw.x,raw.z,p.y);
    const safe=!hit.blocked&&Math.abs(hit.height-p.y)<.34,ground=safe?hit.height:p.y;
    const stance=support[i];
    const plant=stance&&prior?.stance&&!reset;
    // Retain an anchor only within a small correction budget. On a sudden turn
    // release it rather than bending the knee to an old unreachable world point.
    const anchored=plant&&Math.hypot(prior.x-sole.x,prior.z-sole.z)<.09;
    const target={x:anchored?prior.x:sole.x,y:stance?ground:Math.max(raw.y,ground),z:anchored?prior.z:sole.z};
    const correction={x:target.x-sole.x,y:clamp(target.y-raw.y,-.14,.14),z:target.z-sole.z};
    if(stance&&!prior?.stance&&!reset&&state.weight>.02){
      state.stepCount++;events.push({type:'step',foot:fkFoot.side,surface:hit.surface,indoor:hit.indoor,speed:state.speed,intensity:clamp(.22+state.speed*.095,.22,1.15),stanceId:state.stepCount});
    }
    return{side:fkFoot.side,...target,raw,sole,stance,phase:wrap(state.phase+(i?.5:0)),lift:Math.max(0,raw.y-ground),
      yaw:state.facing,pitch:0,legPlaneYaw:0,surface:hit.surface,indoor:hit.indoor,correction,reachCorrected:false,
      anchored,anchorId:(prior?.anchorId||0)+(anchored?0:1),contactZ:fkFoot.contactZ};
  });
  state.feet=feet;state.pose=encode(pose);
  state.body={offsetX:pose.position[0],offsetY:pose.position[1],offsetZ:pose.position[2],yaw:0,roll:0};
}
function advanceGait(state,options){
  const dt=finite(options.dt);if(dt<=0)return[];
  const p=position(options.player),old=state.player,dx=p.x-old.x,dz=p.z-old.z,distance=Math.hypot(dx,dz),sample=options.sampleGround||state.sampleGround;
  if(dt>.25||distance>Math.max(2,dt*45)){
    const count=state.stepCount;Object.assign(state,createGait(p,sample),{stepCount:count,grounded:!!options.grounded,mounted:!!options.mounted});return[];
  }
  const actualSpeed=distance/dt,moving=actualSpeed>.025,events=[],grounded=!!options.grounded&&!options.mounted,mounted=!!options.mounted;
  const posture=options.posture||'stand',alpha=1-Math.exp(-dt*12);
  state.proneBlend=clamp((state.proneBlend||0)+(posture==='prone'?1:-1)*dt/.9,0,1);
  state.crouchBlend=(state.crouchBlend||0)+((posture==='crouch'?1:0)-(state.crouchBlend||0))*alpha;
  const landed=grounded&&!state.grounded&&!state.mounted&&state.airTime>.075;
  state.speed=mix(state.speed,actualSpeed,1-Math.exp(-dt*14));
  if(moving)state.direction=directionView(dx,dz,p.heading);
  const directionBlend=1-Math.exp(-dt*12);
  for(const key of DIRECTIONS)state.poseDirection[key]=mix(state.poseDirection[key],state.direction[key],directionBlend);
  // Body heading belongs to keyboard locomotion, never to orbit-camera yaw.
  const targetFacing=p.heading;
  const turn=delta(state.facing,targetFacing);
  state.turningInPlace=grounded&&!moving&&Math.abs(turn)>.002;
  state.facing+=clamp(turn,-dt*5.5,dt*5.5);
  const style=motionStyle(state.speed);
  Object.assign(state,{walkBlend:style.walk,jogBlend:style.jog,sprintBlend:style.sprint,runBlend:1-style.walk,gaitMode:style.sprint>.5?'sprint':style.jog>.5?'jog':'walk'});
  const targetWeight=grounded?(moving?1:state.turningInPlace?.35:0):0;
  state.weight=mix(state.weight,targetWeight,1-Math.exp(-dt*(moving?10:13)));
  state.transition=mounted?'seated':!grounded?'flight':state.turningInPlace?'turn':moving?(state.weight<.95?'start':'travel'):state.weight>.015?'stop':'idle';
  if(moving&&grounded){
    const stride=style.walk*CLIP_INFO.walk.stride+style.jog*CLIP_INFO.jog.stride+style.sprint*CLIP_INFO.sprint.stride;
    const postureStride=posture==='crouch'?CLIP_INFO.crouchWalk.stride:posture==='prone'?1.05:stride;
    state.phase=wrap(state.phase+distance/Math.max(.6,postureStride*directionalStrideScale(state.poseDirection)));
  }else if(state.turningInPlace)state.phase=wrap(state.phase+dt*.75);
  if(state.transition==='stop')state.phase=wrap(state.phase+dt*.65);
  if(!moving&&state.weight<.015){state.weight=0;state.idlePhase=wrap(state.idlePhase+dt/CLIP_INFO.idle.duration);}
  let pose;
  if(!grounded||mounted){
    state.airTime+=mounted?0:dt;state.impactSpeed=Math.max(0,-finite(options.verticalSpeed));
    pose=restingPose(mounted?'seated':'flight',options.jump?.airborne?options.jump.time/CLIP_INFO.flight.duration:.35);
  }else if(state.weight===0)pose=restingPose('idle',state.idlePhase);
  else if(state.weight===1)pose=directionalPose(style,state.phase,state.poseDirection);
  else pose=blendPose(restingPose('idle',state.idlePhase),directionalPose(style,state.phase,state.poseDirection),state.weight);
  if(grounded&&!mounted){
    if(state.crouchBlend>.001)pose=blendPose(pose,crouchPose(state.phase,state.weight,state.poseDirection),state.crouchBlend);
    if(state.proneBlend>.001)pose=proneTransitionPose(pose,state.proneBlend,state.phase,state.weight,state.poseDirection);
    pose.rotations[2].premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-(options.lean||0)*.22));
    if(posture!=='stand')state.transition=posture;
  }
  if(options.jump?.airborne)state.transition='jump';
  state.grounded=grounded;state.mounted=mounted;
  resolveFeet(state,pose,p,sample,events,landed);
  if(landed){
    const foot=state.feet[0];state.stepCount++;
    events.push({type:'land',foot:foot.side,surface:foot.surface,indoor:foot.indoor,speed:state.speed,intensity:clamp(.3+Math.max(state.impactSpeed,-finite(options.verticalSpeed))*.17,.3,1.5),stanceId:state.stepCount});
  }
  if(grounded){state.airTime=0;state.impactSpeed=0;}
  state.player=p;state.moving=moving&&grounded;return events;
}
export function updateGait(state,options){
  const dt=finite(options.dt);if(dt<=0)return[];
  const target=position(options.player),previous={...state.player};
  if(dt>.25||Math.hypot(target.x-previous.x,target.z-previous.z)>Math.max(2,dt*45))return advanceGait(state,options);
  const count=Math.ceil(dt*120),events=[];
  for(let i=1;i<=count;i++){
    const t=i/count,player={x:mix(previous.x,target.x,t),y:mix(previous.y,target.y,t),z:mix(previous.z,target.z,t),yaw:previous.yaw+delta(previous.yaw,target.yaw)*t,heading:previous.heading+delta(previous.heading,target.heading)*t};
    events.push(...advanceGait(state,{...options,player,dt:dt/count}));
  }
  return events;
}
export function gaitView(state){
  const{phase,weight,runBlend,speed,walkBlend,jogBlend,sprintBlend,gaitMode,facing,grounded,mounted,stepCount,transition,turningInPlace}=state;
  return{phase,weight,runBlend,speed,walkBlend,jogBlend,sprintBlend,gaitMode,facing,grounded,mounted,stepCount,transition,turningInPlace,...(state.proneBlend>0?{proneBlend:state.proneBlend}:{}),
    direction:{...state.direction},safetyCorrections:0,body:{...state.body},pose:{position:[...state.pose.position],rotations:state.pose.rotations.map(q=>[...q])},feet:state.feet.map(f=>({...f,correction:{...f.correction}}))};
}
