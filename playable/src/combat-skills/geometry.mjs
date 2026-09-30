export const distance=(a,b)=>Math.hypot(a.x-b.x,(a.y||0)-(b.y||0),a.z-b.z);
export const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export const forward=(yaw,pitch=0)=>({x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)});
export const along=(p,d,n)=>({x:p.x+d.x*n,y:p.y+(d.y||0)*n,z:p.z+d.z*n});
export const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:(a.y||0)+((b.y||0)-(a.y||0))*t,z:a.z+(b.z-a.z)*t});
export function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,l=dx*dx+dy*dy+dz*dz;const t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/l)):0;return {distance:distance(p,lerp(a,b,t)),t};}
export function meleeContact(skill,cast,target,from,to){
  if(Math.abs(target.y-cast.origin.y)>1.1)return false;
  const bearing=wrap(Math.atan2(cast.origin.x-target.x,cast.origin.z-target.z)-cast.yaw),radius=target.radius??.35;
  if(skill.id==='WS03')return segmentDistance(target,cast.origin,along(cast.origin,forward(cast.yaw),3)).distance<=.3+radius;
  // A continuous angular interval swept by the blade, including a target capsule.
  const r=distance(cast.origin,target);if(r>3+radius)return false;
  const half=50*Math.PI/180,slack=Math.asin(Math.min(1,radius/Math.max(radius,r)));
  const phase=t=>Math.max(0,Math.min(1,(t-cast.release)/skill.activeDuration));
  return bearing>=-half+2*half*phase(from)-slack&&bearing<=-half+2*half*phase(to)+slack;
}
export function shieldIntersects(barrier,from,target,now){
  if(!barrier||now>=barrier.until)return false;
  const radial=Math.hypot(from.x-target.x,from.z-target.z);
  // The visible fan is 1.25m forward with a total height of 2m. A strike
  // starting inside the fan does not cross it; height is checked at the crossing.
  if(radial<1.25||Math.abs((from.y-target.y)*1.25/radial)>1)return false;
  const bearing=Math.atan2(target.x-from.x,target.z-from.z);
  return Math.abs(wrap(bearing-barrier.yaw))<=Math.PI/3;
}
export function castPhase(cast,time){if(!cast||time<cast.start||time>=cast.end||cast.interrupted)return null;return {phase:time<cast.release?'anticipation':time<cast.activeEnd?'active':'recovery',castId:cast.id,skillId:cast.skillId,yaw:cast.yaw,progress:(time-cast.start)/(cast.end-cast.start)};}
export function steerCast(cast,definition,time,aimYaw){
 if(cast.aimFrozen||!Number.isFinite(aimYaw))return cast.yaw;
 const end=definition.hit==='H2'?Math.min(time,cast.release-.15):Math.min(time,cast.activeEnd);
 const wind=Math.max(0,Math.min(end,cast.release)-cast.last),active=Math.max(0,end-Math.max(cast.last,cast.release));
 const limit=(90*wind+30*active)*Math.PI/180;
 return wrap(cast.yaw+Math.max(-limit,Math.min(limit,wrap(aimYaw-cast.yaw))));
}
