import * as THREE from 'three';

// All anchors are in the original hull's authored metre coordinates (-Z forward).
export const VEHICLE_RIG=Object.freeze({hullLift:.16,seat:[0,.98,.13],steering:[0,1.19,-.48],eye:[0,1.72,.13]});
export function gripAnchor(side,angle=0){
  return new THREE.Vector3(side*.30,.035,.03).applyAxisAngle(new THREE.Vector3(0,1,0),angle).add(new THREE.Vector3(...VEHICLE_RIG.steering));
}
export function steeringAngle(controls={}){return (Number(!!controls.left)-Number(!!controls.right))*.22;}

// Run after planet-runtime has installed the final support quaternion. A single
// rigid transform carries rider, grips and eye even on the opposite hemisphere.
export function applyMountedVehicleView({avatar,skimmer,camera,view,cameraState}){
  if(!view.mobility?.vehicle?.mounted)return;
  avatar.root.quaternion.copy(skimmer.root.quaternion);
  avatar.root.position.copy(skimmer.root.position).add(new THREE.Vector3(0,VEHICLE_RIG.hullLift,0).applyQuaternion(skimmer.root.quaternion));
  avatar.root.updateMatrixWorld(true);
  avatar.root.visible=true;cameraState.avatarVisible=true;
  if(view.cameraMode!=='vehicle-first')return;
  const eye=avatar.eyePosition()||new THREE.Vector3(...VEHICLE_RIG.eye).applyMatrix4(avatar.root.matrixWorld);
  const relativeYaw=(view.player.yaw||0)-(view.mobility.vehicle.yaw||0),pitch=view.player.pitch||0;
  const forward=new THREE.Vector3(-Math.sin(relativeYaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(relativeYaw)*Math.cos(pitch)).applyQuaternion(skimmer.root.quaternion);
  camera.position.copy(eye);camera.up.set(0,1,0).applyQuaternion(skimmer.root.quaternion);camera.lookAt(eye.clone().add(forward));
  cameraState.position={x:eye.x,y:eye.y,z:eye.z};cameraState.target={x:eye.x+forward.x,y:eye.y+forward.y,z:eye.z+forward.z};
}
