import {movementHeading} from './movement.mjs';
const angle=value=>Math.atan2(Math.sin(value),Math.cos(value));
const clampPitch=value=>Math.max(-1.35,Math.min(1.35,value));
export const createLookControl=()=>({free:false,returning:false,returnPitch:0});
export function leaveVehicleLook(state,player){
  Object.assign(state,createLookControl());
  player.yaw=angle(player.yaw||0);player.heading=player.yaw;
  player.pitch=clampPitch(player.pitch||0);state.returnPitch=player.pitch;
}
export function setFreeLook(state,player,free){
  if(state.free===free)return;
  if(free){if(!state.returning)state.returnPitch=player.pitch||0;state.returning=false;}
  else state.returning=true;
  state.free=free;
}
export function applyMouseLook(state,player,dx,dy,{mounted=false}={}){
  if(!Number.isFinite(dx)||!Number.isFinite(dy))return;
  const turn=-dx*.0022;
  player.yaw=angle((player.yaw||0)+turn);
  player.pitch=clampPitch((player.pitch||0)-dy*.0022);
  if(!state.free&&!mounted){
    player.heading=angle(movementHeading(player)+turn);
    // A fresh vertical input takes priority over the return animation.
    if(state.returning&&dy!==0)state.returnPitch=player.pitch;
  }
}
export function updateLookControl(state,player,dt,{mounted=false,vehicleHeading}={}){
  if(state.free||!state.returning)return;
  if(mounted&&!Number.isFinite(vehicleHeading)){state.returning=false;return;}
  const heading=mounted?vehicleHeading:movementHeading(player);
  const blend=1-Math.exp(-12*Math.max(0,Math.min(Number.isFinite(dt)?dt:0,.05)));
  const gap=angle(player.yaw-heading);
  player.yaw=angle(player.yaw-gap*blend);
  player.pitch+=(state.returnPitch-player.pitch)*blend;
  if(Math.abs(gap)<.001&&Math.abs(player.pitch-state.returnPitch)<.001){
    player.yaw=heading;player.pitch=state.returnPitch;state.returning=false;
  }
}
