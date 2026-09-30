import * as THREE from 'three';import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createAvatar} from '../playable/src/avatar.mjs';import {pronePose,proneTransitionPose}from'../playable/src/tactical-pose.mjs';import {restingPose}from'../playable/src/authored-motion.mjs';
window.exportProne=async()=>{
 const avatar=createAvatar([]);await avatar.assetReady;const root=avatar.root,native=[];root.traverse(o=>{if(o.isBone&&o.name.startsWith('c2-native-'))native.push(o);});
 const clips=[],direction={forward:1,backward:0,left:0,right:0},idle=restingPose('idle',0);
 function apply(pose,progress,time){avatar.update({x:0,z:0,y:0,yaw:0,heading:0,pitch:0,posture:progress>0?'prone':'stand'},{cameraMode:'third',time,gait:{proneBlend:progress,pose:{position:pose.position,rotations:pose.rotations.map(q=>q.toArray())},phase:time/2,weight:0}},0,1/30);root.updateMatrixWorld(true);}
 for(const [name,duration,sample]of [
  ['ProneDown',.9,t=>[proneTransitionPose(idle,t,0,0,direction),t]],
  ['ProneIdle',2,t=>[pronePose(0,0,direction),1]],
  ['ProneCrawl',2,t=>[pronePose(t,1,direction),1]],
  ['ProneUp',.9,t=>[proneTransitionPose(idle,1-t,0,0,direction),1-t]],
 ]){
  const times=[],q=native.map(()=>[]),p=native.map(()=>[]),frames=Math.round(duration*30);
  for(let i=0;i<=frames;i++){const t=i/frames,[pose,progress]=sample(t);apply(pose,progress,t*duration);times.push(t*duration);native.forEach((bone,j)=>{q[j].push(...bone.quaternion.toArray());p[j].push(...bone.position.toArray());});}
  const tracks=[];native.forEach((bone,i)=>{tracks.push(new THREE.QuaternionKeyframeTrack(bone.name+'.quaternion',times,q[i]),new THREE.VectorKeyframeTrack(bone.name+'.position',times,p[i]));});clips.push(new THREE.AnimationClip(name,duration,tracks));
 }
 apply(pronePose(0,0,direction),1,0);const remove=[];root.traverse(o=>{if(o.material?.isShaderMaterial)remove.push(o);const g=o.geometry,m=g?.getAttribute('proneHandMask');if(m){const ids=g.index?.array??Array.from({length:m.count},(_,i)=>i),keep=[];for(let i=0;i<ids.length;i+=3)if((m.getX(ids[i])+m.getX(ids[i+1])+m.getX(ids[i+2]))/3<=.32)keep.push(ids[i],ids[i+1],ids[i+2]);g.setIndex(keep);}});remove.forEach(o=>o.removeFromParent());
 const bytes=new Uint8Array(await new GLTFExporter().parseAsync(root,{binary:true,animations:clips,onlyVisible:true}));let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return {base64:btoa(binary),bytes:bytes.length,clips:clips.map(c=>({name:c.name,duration:c.duration})),joints:native.length};
};
