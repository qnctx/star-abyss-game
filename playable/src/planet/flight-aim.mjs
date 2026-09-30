import {add,dot,globalToLocal,localToGlobal,scale,tangentFrame,toGeodetic,unit} from './coordinates.mjs';

const maxPitch=1.35;
const clampPitch=value=>Math.max(-maxPitch,Math.min(maxPitch,value));
const heading=direction=>({yaw:Math.atan2(-direction.x,-direction.z),pitch:Math.atan2(direction.y,Math.hypot(direction.x,direction.z))});
const surfaceFrame=(position,radius)=>{const geo=toGeodetic(position,radius);return tangentFrame(geo.lat,geo.lon,radius);};

/** Camera's tangent-space forward projected into the fixed six-kilometre basin chart. */
export function flightAimInLocal({position,yaw,pitch=0,frame,radius}){
  if(![yaw,pitch].every(Number.isFinite))throw new RangeError('Finite flight aim required');
  const basis=surfaceFrame(position,radius),horizontal=Math.cos(pitch);
  const direction=add(add(scale(basis.east,-Math.sin(yaw)*horizontal),scale(basis.south,-Math.cos(yaw)*horizontal)),scale(basis.up,Math.sin(pitch)));
  const local=unit({x:dot(direction,frame.east),y:dot(direction,frame.up),z:dot(direction,frame.south)});
  const angles=heading(local);
  return {...angles,pitch:clampPitch(angles.pitch),direction:local};
}

/** Inverse aim for a basin-local body target. Output angles use the moving surface tangent frame. */
export function flightAimAtLocal({position,target,frame,radius,originHeight=1}){
  if(!target||![target.x,target.y,target.z,originHeight].every(Number.isFinite))throw new RangeError('Finite local target required');
  const basis=surfaceFrame(position,radius),origin=add(position,scale(basis.up,originHeight)),end=localToGlobal(target,frame);
  const global=unit({x:end.x-origin.x,y:end.y-origin.y,z:end.z-origin.z});
  const tangent=unit({x:dot(global,basis.east),y:dot(global,basis.up),z:dot(global,basis.south)});
  const angles=heading(tangent);
  return {...angles,pitch:clampPitch(angles.pitch),direction:tangent,origin:globalToLocal(origin,frame)};
}
