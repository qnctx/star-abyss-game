import * as THREE from 'three';
import data from './authored-motion-data.mjs';
import {HUMANOID_RIG} from './humanoid-rig.mjs';
const clamp=THREE.MathUtils.clamp;
// Immutable source frames are normalized once, never once per animation tick.
// Returned poses still own their quaternions: callers can freely retarget them.
const normalizedFrames=new Map();
function clipFrames(name){
  if(!normalizedFrames.has(name))normalizedFrames.set(name,data.clips[name].frames.map(frame=>({position:frame.slice(0,3),rotations:HUMANOID_RIG.map((_,n)=>new THREE.Quaternion().fromArray(frame,3+n*4).normalize())})));
  return normalizedFrames.get(name);
}
const copyPose=pose=>({position:pose.position.slice(),rotations:pose.rotations.map(q=>q.clone())});
export function sampleClip(name,phase){
  const frames=clipFrames(name),t=((phase%1)+1)%1*(frames.length-1),i=Math.floor(t),a=frames[i],b=frames[i+1],f=t-i;
  const position=a.position.map((v,j)=>THREE.MathUtils.lerp(v,b.position[j],f)),rotations=[];
  for(let n=0;n<HUMANOID_RIG.length;n++)rotations.push(a.rotations[n].clone().slerp(b.rotations[n],f).normalize());
  return{position,rotations};
}
export function blendPose(a,b,t){
  if(t===0)return copyPose(a);
  if(t===1)return copyPose(b);
  return{position:a.position.map((v,i)=>THREE.MathUtils.lerp(v,b.position[i],t)),rotations:a.rotations.map((q,i)=>q.clone().slerp(b.rotations[i],t))};
}
function footFromAnkle(ankle,rotation,side){
  const sole=new THREE.Vector3(0,-.095,-.05).applyQuaternion(rotation).add(ankle);
  const heel=new THREE.Vector3(0,-.095,.072).applyQuaternion(rotation).add(ankle);
  const toe=new THREE.Vector3(0,-.095,-.182).applyQuaternion(rotation).add(ankle);
  const heelContact=heel.y<toe.y;
  return{side,sole,contact:heelContact?heel:toe,ankle,rotation,contactZ:heelContact?.072:-.182};
}
// Contact and retargeting need only pelvis -> thigh -> shin -> ankle. Avoid
// traversing/allocating the head and twelve upper-body transforms at 120 Hz.
export function forwardFeet(pose){
  const root=new THREE.Vector3(...HUMANOID_RIG[0][2]).add(new THREE.Vector3(...pose.position));
  const feet=[];
  for(const hip of [13,16]){
    let p=root,q=pose.rotations[0];
    for(let i=hip;i<hip+3;i++){
      p=new THREE.Vector3(...HUMANOID_RIG[i][2]).applyQuaternion(q).add(p);
      q=pose.rotations[i].clone().premultiply(q);
    }
    feet.push(footFromAnkle(p,q,hip===13?-1:1));
  }
  return{feet};
}
export function forwardPose(pose){
  const positions=[],rotations=[];
  HUMANOID_RIG.forEach(([,parent,offset],i)=>{
    const q=pose.rotations[i].clone(),p=new THREE.Vector3(...offset);
    if(parent<0)p.add(new THREE.Vector3(...pose.position));
    else{p.applyQuaternion(rotations[parent]).add(positions[parent]);q.premultiply(rotations[parent]);}
    positions.push(p);rotations.push(q);
  });
  return{positions,rotations,feet:[15,18].map((i,k)=>footFromAnkle(positions[i],rotations[i],k?1:-1))};
}
// Derive floor calibration, support intervals and stride from the retargeted
// clip itself. These are observations of FK animation, not foot-path templates.
export const CLIP_INFO={};
for(const name of Object.keys(data.clips)){
  const samples=Array.from({length:120},(_,i)=>forwardFeet(sampleClip(name,i/120)).feet);
  const floor=Math.min(...samples.flatMap(feet=>feet.map(f=>f.contact.y)));
  const support=samples.map(feet=>feet.map(f=>f.contact.y-floor<.075));
  // Robust stance-backward speed; exclude toe roll and double-support endpoints.
  const speeds=[];
  for(let i=1;i<119;i++)for(let k=0;k<2;k++)if(support[i][k]&&support[i-1][k]&&support[i+1][k]){
    const v=(samples[i+1][k].sole.z-samples[i-1][k].sole.z)*60;
    if(v>.25)speeds.push(v);
  }
  speeds.sort((a,b)=>a-b);
  const stride=speeds.length?speeds[Math.floor(speeds.length*.5)]:1;
  CLIP_INFO[name]={duration:data.clips[name].duration,floor,stride,support,source:data.clips[name].source};
}
export function motionStyle(speed){
  const jog=clamp((speed-1.8)/1.7,0,1),sprint=clamp((speed-5)/2.5,0,1);
  return{walk:1-jog,jog:jog*(1-sprint),sprint};
}
export function locomotionPose(style,phase){
  if(style.walk+style.jog+style.sprint===1&&(style.walk===1||style.jog===1||style.sprint===1)){
    const name=style.walk===1?'walk':style.jog===1?'jog':'sprint',pose=sampleClip(name,phase);
    pose.position[1]-=CLIP_INFO[name].floor;return pose;
  }
  let pose=sampleClip('walk',phase),floor=CLIP_INFO.walk.floor;
  if(style.jog+style.sprint>0){
    const run=blendPose(sampleClip('jog',phase),sampleClip('sprint',phase),style.sprint/Math.max(.001,style.jog+style.sprint));
    pose=blendPose(pose,run,style.jog+style.sprint);
    floor=CLIP_INFO.walk.floor*style.walk+CLIP_INFO.jog.floor*style.jog+CLIP_INFO.sprint.floor*style.sprint;
  }
  pose.position[1]-=floor;
  return pose;
}
// Directional retargeting is an analytic adaptation of the licensed forward
// clips, not additional motion capture. Preserve their contact timing and
// whole-body rhythm; solve bent knees toward new ankle targets rather than
// rotating a straight leg (or the entire character) into the travel vector.
export function directionalStrideScale(direction){return direction.forward+.72*direction.backward+.55*(direction.left+direction.right);}
export function directionalPose(style,phase,direction){
  const source=locomotionPose(style,phase),amount=1-direction.forward;
  if(amount<1e-6)return source;
  const pose=copyPose(source),fk=forwardFeet(source);
  const lateral=direction.right-direction.left,forward=direction.forward-.72*direction.backward;
  pose.position[0]*=.65;pose.position[2]*=.6;
  const turn=new THREE.Quaternion().setFromEuler(new THREE.Euler(-.055*direction.backward,0,-.065*lateral));
  pose.rotations[0].premultiply(turn);
  pose.rotations[3].premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.035*direction.backward,0,.045*lateral)));
  const root=new THREE.Vector3(...HUMANOID_RIG[0][2]).add(new THREE.Vector3(...pose.position)),down=new THREE.Vector3(0,-1,0);
  for(let index=0;index<2;index++){
    const hip=index?16:13,knee=hip+1,ankle=hip+2,side=index?1:-1,foot=fk.feet[index];
    const travel=-foot.ankle.z;
    const target=new THREE.Vector3(side*.145+travel*.55*lateral,foot.contact.y+.095,-travel*forward);
    // A non-crossing step-together stance is deliberate: rapid lateral travel
    // uses shorter, quicker steps instead of passing one shin through the other.
    target.x=side<0?Math.min(-.12,target.x):Math.max(.12,target.x);
    const start=new THREE.Vector3(...HUMANOID_RIG[hip][2]).applyQuaternion(pose.rotations[0]).add(root),axis=target.clone().sub(start),distance=clamp(axis.length(),.12,.882);
    axis.normalize();target.copy(start).addScaledVector(axis,distance);
    const pole=new THREE.Vector3(side*.12,0,-1).addScaledVector(axis,-new THREE.Vector3(side*.12,0,-1).dot(axis)).normalize();
    const bend=Math.sqrt(Math.max(0,.445*.445-distance*distance/4));
    const kneePoint=start.clone().addScaledVector(axis,distance/2).addScaledVector(pole,bend);
    const upper=new THREE.Quaternion().setFromUnitVectors(down,kneePoint.clone().sub(start).normalize());
    const lower=new THREE.Quaternion().setFromUnitVectors(down,target.clone().sub(kneePoint).normalize());
    pose.rotations[hip].copy(pose.rotations[0]).invert().multiply(upper);
    pose.rotations[knee].copy(upper).invert().multiply(lower);
    pose.rotations[ankle].copy(lower).invert();
  }
  return blendPose(source,pose,amount);
}
export function restingPose(name,phase=0){
  const pose=sampleClip(name,phase);
  if(name==='idle'){
    // Idle source has pelvis/leg sway. Against locked terrain contacts this
    // repeatedly changes knee IK even while the player is stationary. Keep
    // the relaxed lower-body pose fixed; breathing belongs above the pelvis.
    const planted=clipFrames('idle')[0];
    pose.position=planted.position.slice();
    for(const bone of [0,13,14,15,16,17,18])pose.rotations[bone].copy(planted.rotations[bone]);
    pose.position[1]-=CLIP_INFO.idle.floor;
    // Keep the licensed upper-body breathing; soft, unequal elbow rests
    // avoid a mirror-symmetric mechanical silhouette without inventing steps.
    pose.rotations[7].multiply(IDLE_LEFT_ELBOW);
    pose.rotations[11].multiply(IDLE_RIGHT_ELBOW);
    pose.rotations[3].multiply(IDLE_CHEST);
  }
  return pose;
}
const IDLE_LEFT_ELBOW=new THREE.Quaternion().setFromEuler(new THREE.Euler(-.06,0,.025));
const IDLE_RIGHT_ELBOW=new THREE.Quaternion().setFromEuler(new THREE.Euler(-.095,0,-.015));
const IDLE_CHEST=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,.018,.009));
export function clipSupport(style,phase,side){
  const i=Math.floor(((phase%1)+1)%1*120),k=side<0?0:1;
  return style.walk*Number(CLIP_INFO.walk.support[i][k])+style.jog*Number(CLIP_INFO.jog.support[i][k])+style.sprint*Number(CLIP_INFO.sprint.support[i][k])>.5;
}
