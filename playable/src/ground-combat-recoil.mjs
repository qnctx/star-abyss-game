// Authoritative hit callbacks supply total displacement, never per-frame velocity.
export function createGroundCombatRecoil(){
 let pending=null,lastId=null;
 return {clear(){pending=null;},start(hit){
   if(!hit||hit.id===lastId||![hit.dx,hit.dz].every(Number.isFinite))return false;
   const scale=Math.min(1,6/Math.max(1,Math.hypot(hit.dx,hit.dz)));lastId=hit.id;pending={dx:hit.dx*scale,dz:hit.dz*scale,elapsed:0};return true;
 },step(player,dt,queries){
   if(!pending)return false;const before=pending.elapsed,next=Math.min(.55,before+Math.max(0,Math.min(.05,dt))),factor=(Math.exp(-3*before/.55)-Math.exp(-3*next/.55))/(1-Math.exp(-3));
   const p={x:player.x+pending.dx*factor,z:player.z+pending.dz*factor};
   if(queries.canTraverse(player,p,.55)){player.x=p.x;player.z=p.z;player.y=queries.terrainHeight(p.x,p.z);}else pending=null;
   player.vx=0;player.vz=0;if(pending){pending.elapsed=next;if(next>=.55)pending=null;}return true;
 },get active(){return !!pending;}};
}
