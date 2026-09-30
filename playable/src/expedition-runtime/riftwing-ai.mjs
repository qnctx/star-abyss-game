import {angle,combatBody,spatialDistance} from './rules.mjs';

export const RIFTWING_ATTACKS=Object.freeze({
  claw:Object.freeze({kind:'riftwing-claw',windup:.44,recovery:.8,reach:2.45,height:2.1,cone:.9}),
  dive:Object.freeze({kind:'riftwing-dive',windup:.62,recovery:1.0,reach:2.8,height:2.35,cone:1.05}),
  sweep:Object.freeze({kind:'riftwing-sweep',windup:.5,recovery:.9,reach:2.7,height:2.2,cone:1.2})
});
export const RIFTWING_ENVELOPE=Object.freeze({groundRadius:2.16,airRadius:2.97,transitionRadius:3.46,height:2.85});
export const isRiftwingKind=kind=>Object.values(RIFTWING_ATTACKS).some(move=>move.kind===kind);
export const riftwingAttack=kind=>Object.values(RIFTWING_ATTACKS).find(move=>move.kind===kind);
export const riftwingSkill=move=>({id:'expedition-'+move.kind,kind:'basic',minimumRealm:0,channel:'physical',weights:['1'],maxTargets:1});
export const initialRiftwingState=()=>({mode:'ground',modeSince:0,aggroUntil:0,stunUntil:0,lastMoved:0,impulseX:0,impulseY:0,impulseZ:0,impulseStart:0,impulseEnd:0,impulseApplied:0});

const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const planar=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const facing=(a,b)=>Math.atan2(a.x-b.x,a.z-b.z);

/** Ground uses the existing slope/solid sweep; air requires the runtime's
 * volumetric shell sweep. A missing air adapter is a blocked path, not clear. */
export function riftwingSweep(queries,from,to,{radius=RIFTWING_ENVELOPE.airRadius,height=RIFTWING_ENVELOPE.height,air=true}={}){
  if(![from.x,from.y,from.z,to.x,to.y,to.z].every(Number.isFinite)||
    Math.abs(to.x)>=2999-radius||Math.abs(to.z)>=2999-radius)return false;
  const distance=Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z);
  if(distance>1.2)return false;
  if(!air)return queries.canTraverse(from,to,radius)&&queries.canOccupy(to,radius)&&
    typeof queries.canAirTraverse==='function'&&queries.canAirTraverse(from,to,radius,height)===true;
  const steps=Math.max(1,Math.ceil(distance/.15));
  for(let i=0;i<=steps;i++){
    const t=i/steps,x=from.x+(to.x-from.x)*t,z=from.z+(to.z-from.z)*t,y=from.y+(to.y-from.y)*t,ground=queries.terrainHeight(x,z);
    if(!Number.isFinite(ground)||y<ground-.02||y>ground+1998)return false;
  }
  return typeof queries.canAirTraverse==='function'&&queries.canAirTraverse(from,to,radius,height)===true;
}

export function riftwingContact(from,to,yaw,move,queries){
  const a=combatBody(from,queries.terrainHeight),b=combatBody(to,queries.terrainHeight);
  return spatialDistance(a,b)<=move.reach&&Math.abs(a.y-b.y)<=move.height&&
    Math.abs(angle(facing(a,b)-yaw))<=move.cone&&queries.hasLineOfSight(a,b);
}

/** One bounded movement step. State and location are copied for checkpoint/CAS.
 * No mode transition assigns a position: every displacement passes the sweep. */
export function advanceRiftwing({location,state,player,def,now,dt,queries,enabled=true,protectedPoint=()=>false,hp=1,pending=null}){
  const loc={...location},memory={...state},ground=queries.terrainHeight(loc.x,loc.z);
  if(!Number.isFinite(ground)||!Number.isFinite(hp)||hp<=0)return {location:loc,state:memory,pursuing:false};
  loc.y=Number.isFinite(loc.y)?loc.y:ground;
  const playerGround=queries.terrainHeight(player.x,player.z),inTerritory=planar(player,def.home)<def.territoryRadius;
  const seen=enabled&&inTerritory&&!protectedPoint(player)&&planar(loc,player)<def.perceptionRadius&&
    queries.hasLineOfSight(combatBody(loc,queries.terrainHeight),combatBody(player,queries.terrainHeight));
  if(seen)memory.aggroUntil=now+4;
  const pursuing=enabled&&inTerritory&&!protectedPoint(player)&&now<memory.aggroUntil;
  const playerHigh=Number.isFinite(player.y)&&Number.isFinite(playerGround)&&player.y>playerGround+2.5;
  if(pursuing&&playerHigh&&memory.mode==='ground'){
    const lift={...loc,y:ground+.18};
    if(riftwingSweep(queries,loc,lift,{air:true,radius:RIFTWING_ENVELOPE.transitionRadius})){
      loc.y=lift.y;memory.mode='takeoff';memory.modeSince=now;
    }
  }
  if(pursuing&&playerHigh&&memory.mode==='landing'){memory.mode='takeoff';memory.modeSince=now;}
  if((!pursuing||!playerHigh)&&['air','takeoff'].includes(memory.mode)){memory.mode='landing';memory.modeSince=now;}
  const airborne=memory.mode!=='ground';
  const envelope=memory.mode==='ground'?RIFTWING_ENVELOPE.groundRadius:memory.mode==='air'?RIFTWING_ENVELOPE.airRadius:RIFTWING_ENVELOPE.transitionRadius;
  if(airborne&&memory.mode!=='landing'&&loc.y<ground+.18){
    const lift={...loc,y:ground+.18};
    if(!riftwingSweep(queries,loc,lift,{air:true,radius:envelope}))return {location:loc,state:memory,pursuing:false};
    loc.y=lift.y;
  }
  let goal;
  if(pursuing)goal={x:player.x,z:player.z,y:playerHigh?clamp(player.y,ground+2,ground+1998):ground};
  else goal={x:def.home.x,z:def.home.z,y:queries.terrainHeight(def.home.x,def.home.z)};
  const desiredYaw=facing(loc,goal),turn=angle(desiredYaw-loc.yaw),maxTurn=3.3*dt;
  loc.yaw=angle(loc.yaw+clamp(turn,-maxTurn,maxTurn));
  // A real hit interrupts pursuit while knockback travels through the same sweep.
  if(memory.impulseEnd>memory.impulseStart&&memory.impulseApplied<1){
    const progress=clamp((now-memory.impulseStart)/(memory.impulseEnd-memory.impulseStart),0,1),eased=1-(1-progress)**2,part=Math.max(0,eased-memory.impulseApplied);
    if(part>0){
      const to={x:loc.x+memory.impulseX*part,y:loc.y+memory.impulseY*part,z:loc.z+memory.impulseZ*part};
      if(riftwingSweep(queries,loc,to,{air:airborne,radius:envelope})){Object.assign(loc,to);memory.impulseApplied=eased;}
      else memory.impulseApplied=1;
    }
  }
  if(now<memory.stunUntil)return {location:loc,state:memory,pursuing};
  const horizontal=planar(loc,goal),gap=airborne?Math.max(0,horizontal-(pursuing?1.9:.5)):Math.max(0,horizontal-(pursuing?1.8:.5));
  const turnFactor=Math.max(.25,Math.cos(angle(desiredYaw-loc.yaw)));
  const speed=(airborne?def.airSpeed:def.moveSpeed)*turnFactor;
  let stride=Math.min(gap,speed*dt);
  // A dive closes at controlled speed during windup; it never snaps to target.
  if(pending?.kind===RIFTWING_ATTACKS.dive.kind)stride=Math.min(gap,def.diveSpeed*dt*turnFactor);
  if(memory.mode==='landing'&&loc.y<=ground+.2)stride=0;
  let dy=0;
  if(memory.mode==='takeoff'||memory.mode==='air')dy=clamp(goal.y-loc.y,-def.climbSpeed*dt,def.climbSpeed*dt);
  else if(memory.mode==='landing'&&loc.y>ground+.2)dy=clamp(ground+.18-loc.y,-def.descendSpeed*dt,def.descendSpeed*dt);
  const len=horizontal||1,to={x:loc.x+(goal.x-loc.x)/len*stride,y:loc.y+dy,z:loc.z+(goal.z-loc.z)/len*stride};
  if(memory.mode==='ground')to.y=queries.terrainHeight(to.x,to.z);
  if(stride>0||Math.abs(dy)>1e-7){
    const air=airborne||to.y>ground+.18;
    if(riftwingSweep(queries,loc,to,{air,radius:envelope})){Object.assign(loc,to);memory.lastMoved=now;}
    else if(stride>0&&Math.abs(dy)>1e-7){
      const vertical={...loc,y:to.y};if(riftwingSweep(queries,loc,vertical,{air:true,radius:envelope})){loc.y=to.y;memory.lastMoved=now;}
    }
  }
  const floor=queries.terrainHeight(loc.x,loc.z);
  if(memory.mode==='takeoff'&&loc.y>=floor+2&&now-memory.modeSince>=1.2){memory.mode='air';memory.modeSince=now;}
  if(memory.mode==='landing'&&loc.y<=floor+.2){loc.y=floor;if(now-memory.modeSince>=1.3){memory.mode='ground';memory.modeSince=now;}}
  if(memory.mode==='ground')loc.y=floor;
  return {location:loc,state:memory,pursuing,seen};
}
