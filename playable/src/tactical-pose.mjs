import * as THREE from 'three';
import {sampleClip,CLIP_INFO,blendPose,forwardPose} from './authored-motion.mjs';
import {HUMANOID_RIG} from './humanoid-rig.mjs';
import {VEHICLE_RIG,gripAnchor} from './vehicle-rig.mjs';
const rotation=(x=0,y=0,z=0)=>new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z));
export function crouchPose(phase,weight,direction){
  const reverse=direction.backward>direction.forward;
  const idle=sampleClip('crouchIdle',0),walk=sampleClip('crouchWalk',reverse?-phase:phase);
  idle.position[1]-=CLIP_INFO.crouchIdle.floor;walk.position[1]-=CLIP_INFO.crouchWalk.floor;
  const pose=blendPose(idle,walk,weight);
  pose.rotations[0].premultiply(rotation(0,(direction.left-direction.right)*.3*weight,0));
  return pose;
}
function aimChain(pose,start,target,hint,endRotation){
 const fk=forwardPose(pose),parent=HUMANOID_RIG[start][1],a=fk.positions[start],upper=Math.abs(HUMANOID_RIG[start+1][2][1]),lower=Math.abs(HUMANOID_RIG[start+2][2][1]);
 const axis=new THREE.Vector3(...target).sub(a),d=THREE.MathUtils.clamp(axis.length(),Math.abs(upper-lower)+.002,upper+lower-.002);axis.normalize();
 const pole=new THREE.Vector3(...hint).sub(a);pole.addScaledVector(axis,-pole.dot(axis)).normalize();
 const along=(upper*upper-lower*lower+d*d)/(2*d),bend=Math.sqrt(Math.max(0,upper*upper-along*along));
 const knee=a.clone().addScaledVector(axis,along).addScaledVector(pole,bend),end=a.clone().addScaledVector(axis,d),down=new THREE.Vector3(0,-1,0);
 const q1=new THREE.Quaternion().setFromUnitVectors(down,knee.clone().sub(a).normalize()),q2=new THREE.Quaternion().setFromUnitVectors(down,end.clone().sub(knee).normalize());
 pose.rotations[start]=fk.rotations[parent].clone().invert().multiply(q1);pose.rotations[start+1]=q1.clone().invert().multiply(q2);pose.rotations[start+2]=q2.clone().invert().multiply(endRotation);
}
// Belly-down, bent elbows beside the chest, forearms ahead, trailing feet.
// Opposite arm/leg advance together; the pelvis stays low rather than bobbing.
export function pronePose(phase,weight,direction){
  const reverse=direction.backward>direction.forward?-1:1,cycle=Math.sin(phase*Math.PI*2)*Math.min(1,weight)*reverse;
  const pose={position:[0,-.75,0],rotations:HUMANOID_RIG.map(()=>rotation())};
  pose.rotations[0]=rotation(-Math.PI/2+.08,0,(direction.right-direction.left)*.035*weight);
  pose.rotations[2]=rotation(.055);pose.rotations[3]=rotation(.035);pose.rotations[4]=rotation(1.35);
  for(const [shoulder,hip,side] of [[6,13,-1],[10,16,1]]){
    const reach=cycle*side,pull=Math.max(0,-reach);
    aimChain(pose,shoulder,[side*(.26+.015*reach),.105+Math.max(0,reach)*.025,-.83-.10*reach],[side*.44,.13,-.51],rotation(Math.PI/2,0,side*.10));
    aimChain(pose,hip,[side*(.16+.12*pull),.12,.83-.19*pull],[side*(.22+.32*pull),.09,.40-.13*pull],rotation(-2.65,0,side*.08));
  }
  return pose;
}
const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
export function seatedVehiclePose(angle=0){
 const pose={position:[0,VEHICLE_RIG.seat[1]-1.01,VEHICLE_RIG.seat[2]],rotations:HUMANOID_RIG.map(()=>rotation())};
 pose.rotations[1]=rotation(-.42);pose.rotations[4]=rotation(.42);
 for(const [arm,leg,side]of [[6,13,-1],[10,16,1]]){
  // The grip runs through the curled palm, 6 cm ahead of the wrist.
  const wrist=gripAnchor(side,angle).add(new THREE.Vector3(0,0,.06).applyAxisAngle(new THREE.Vector3(0,1,0),angle));
  aimChain(pose,arm,wrist.toArray(),[side*.43,1.13,.04],rotation(0,angle,0).multiply(rotation(Math.PI/2)));
  aimChain(pose,leg,[side*.40,.59,-.17],[side*.40,.70,-.46],rotation());
 }
 return pose;
}
export function proneTransitionPose(base,progress,phase,weight,direction){
 const crouch=crouchPose(0,0,direction),flat=pronePose(phase,weight,direction);
 if(progress<.32)return blendPose(base,crouch,smooth(progress/.32));
 return blendPose(crouch,flat,smooth((progress-.32)/.68));
}
