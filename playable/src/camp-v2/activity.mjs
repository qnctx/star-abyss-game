import {registerPhysicalProps} from '../foundation/physical-props.mjs';
import {CAMP_V2_PEOPLE} from './layout.mjs';

/** Slow local work-position changes; no synthetic running animation on models without leg bones. */
export function createCampActivity(id,{speed=.22,holdRadius=4.25}={}){
 const station=CAMP_V2_PEOPLE[id];if(!station)throw Error(`Unknown camp person ${id}`);
 const position={...station.home,y:0},home=station.home,work=station.work;let time=0;
 function update(dt,{player=null,paused=false,ground=()=>0}={}){
  if(!paused&&(!player||Math.hypot(player.x-position.x,player.z-position.z)>holdRadius)){
   time+=Math.max(0,Math.min(dt,.1));const target=Math.floor(time/12)%2?work:home,dx=target.x-position.x,dz=target.z-position.z,distance=Math.hypot(dx,dz),step=Math.min(distance,speed*Math.max(0,dt));
   if(distance>1e-5){position.x+=dx/distance*step;position.z+=dz/distance*step;}
  }
  position.y=ground(position.x,position.z);return position;
 }
 return {position,update,get target(){return Math.floor(time/12)%2?work:home;}};
}

/** A live actor capsule follows the rendered actor. The building itself uses GLB triangles. */
export function installCampActorCollision(getPosition,{radius=.36,height=1.75}={}){
 let enabled=true;
 const provider={support(){return -Infinity;},blocked(x,z,feet,otherRadius,otherHeight){
  if(!enabled)return false;const p=getPosition();return !!p&&Math.hypot(x-p.x,z-p.z)<radius+otherRadius&&feet+otherHeight>p.y+.1&&feet<p.y+height;
 }};
 const remove=registerPhysicalProps(provider);
 return {setEnabled(value){enabled=!!value;},destroy:remove};
}
