import {angle,distance,spatialDistance,verticalSeparation} from './rules.mjs';
import {findPath} from './path.mjs';

const facing=(a,b)=>Math.atan2(a.x-b.x,a.z-b.z);
const fraction=n=>n-Math.floor(n);
const variation=(def,index)=>fraction(Math.sin(def.home.x*12.9898+def.home.z*78.233+index*37.719)*43758.5453);
function beginWatch(memory,def,now) {
  memory.behavior='watch';memory.patrolGoal=null;
  memory.watchUntil=now+.7+variation(def,(memory.patrolIndex||0)+91)*1.3;
  memory.watchYaw=variation(def,(memory.patrolIndex||0)+117)*Math.PI*2-Math.PI;
}
function patrolGoal(enemy,def,memory,now,clear,protectedPoint) {
  if(memory.behavior===undefined)beginWatch(memory,def,now);
  if(memory.watchUntil>now)return null;
  if(memory.patrolGoal&&distance(enemy,memory.patrolGoal)<.3)beginWatch(memory,def,now);
  if(memory.watchUntil>now)return null;
  // A blocked patrol is abandoned after a bounded interval, never teleported.
  if(memory.patrolGoal&&now-(memory.lastMoved??memory.patrolStarted)>2)memory.patrolGoal=null;
  if(!memory.patrolGoal){
    for(let i=0;i<8;i++){
      const index=memory.patrolIndex=(memory.patrolIndex||0)+1;
      const theta=variation(def,index)*Math.PI*2;
      const radius=def.territoryRadius*(.14+.28*variation(def,index+41));
      const goal={x:def.home.x+Math.cos(theta)*radius,z:def.home.z+Math.sin(theta)*radius};
      if(distance(enemy,goal)>1&&!protectedPoint(goal)&&clear(enemy,goal)){
        memory.patrolGoal=goal;memory.patrolStarted=now;memory.route=null;break;
      }
    }
    if(!memory.patrolGoal){beginWatch(memory,def,now);return null;}
  }
  memory.behavior='patrol';return memory.patrolGoal;
}
export function turnToward(yaw,target,dt,rate=5.5) {
  return angle(yaw+Math.max(-rate*dt,Math.min(rate*dt,angle(target-yaw))));
}

/** Transient perception/navigation memory: no additional persistent scene fields. */
export function steerCreature({enemy,player,def,now,dt,enabled,clear,visible,protectedPoint,memory={},hp}) {
  const d=distance(enemy,player),inTerritory=distance(player,def.home)<def.territoryRadius;
  const damaged=memory.hp!==undefined&&hp<memory.hp;memory.hp=hp;
  const homeDistance=distance(enemy,def.home);
  if(homeDistance>=def.territoryRadius||memory.behavior==='chase'&&(!enabled||!inTerritory||protectedPoint(player)))memory.returning=true;
  if(memory.returning&&homeDistance<.4){memory.returning=false;beginWatch(memory,def,now);}
  const detected=enabled&&!memory.returning&&inTerritory&&!protectedPoint(player)&&
    ((d<def.perceptionRadius&&visible(enemy,player))||d<6||damaged);
  if(detected){memory.lastSeen={x:player.x,z:player.z};memory.alertUntil=now+3;}
  const pursuing=enabled&&!memory.returning&&inTerritory&&!protectedPoint(player)&&memory.lastSeen&&now<(memory.alertUntil||0);
  if(!pursuing){
    if(memory.behavior==='chase')memory.returning=true;
    memory.lastSeen=null;memory.alertUntil=0;
  }
  let goal;
  if(pursuing){memory.behavior='chase';memory.patrolGoal=null;goal=memory.lastSeen;}
  else if(memory.returning){memory.behavior='return';goal=def.home;}
  else goal=patrolGoal(enemy,def,memory,now,clear,protectedPoint);
  if(!goal){
    enemy.yaw=turnToward(enemy.yaw,memory.watchYaw??enemy.yaw,dt,.65);
    return {memory,pursuing:false,detected,behavior:memory.behavior};
  }
  // Path search and the actual swept movement share the same territory/safe-zone guard.
  const navigable=(a,b)=>!protectedPoint(b)&&
    (distance(b,def.home)<def.territoryRadius||memory.returning&&distance(b,def.home)<distance(a,def.home))&&clear(a,b);
  const direct=navigable(enemy,goal),close=distance(enemy,goal)<(pursuing?1.9:.2);
  let destination=goal;
  if(!direct&&!close){
    if(now>=(memory.repathAt||0)&&(!memory.route||!memory.route.length||distance(memory.goal,goal)>.75)){
      memory.route=findPath(enemy,goal,navigable);memory.goal={...goal};memory.repathAt=now+.55;
    }
    while(memory.route?.length&&distance(enemy,memory.route[0])<.25)memory.route.shift();
    destination=memory.route?.[0];
  }else memory.route=null;
  const look=pursuing&&detected&&direct?player:destination;
  if(look&&distance(enemy,look)>.05)enemy.yaw=turnToward(enemy.yaw,facing(enemy,look),dt);
  if(!close&&destination){
    const len=distance(enemy,destination),heading=facing(enemy,destination);
    // Brake while turning rather than snapping or sliding backwards at full speed.
    const turnFactor=Math.max(.18,Math.cos(angle(heading-enemy.yaw)));
    const speed=def.moveSpeed*(memory.behavior==='patrol'?.42:memory.behavior==='return'?.7:1);
    const step=Math.min(len,speed*dt*turnFactor);
    if(len>.001){
      const next={x:enemy.x+(destination.x-enemy.x)/len*step,z:enemy.z+(destination.z-enemy.z)/len*step};
      if(navigable(enemy,next)){enemy.x=next.x;enemy.z=next.z;memory.lastMoved=now;}
      else{memory.route=null;memory.repathAt=Math.max(memory.repathAt||0,now+.15);}
    }
  }
  return {memory,pursuing:!!pursuing,detected,behavior:memory.behavior};
}

export function canBeginCreatureAttack(enemy,player,reach,visible) {
  return spatialDistance(enemy,player)<reach&&verticalSeparation(enemy,player)<2&&Math.abs(angle(facing(enemy,player)-enemy.yaw))<.55&&visible(enemy,player);
}
