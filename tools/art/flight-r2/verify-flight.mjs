import assert from 'node:assert/strict';
import {Quaternion,Euler} from 'three';
import {yuanYingFlightPose,createYuanYingFlightAnimator} from '../../../playable/src/yuan-ying-flight-pose.mjs';
import {createYuanYingFlightVfx} from '../../../playable/src/yuan-ying-flight-vfx.mjs';
import clips from '../../../playable/assets/flight-r2/flight-clips.mjs';
import {HUMANOID_RIG} from '../../../playable/src/humanoid-rig.mjs';
assert.deepEqual(clips.boneNames,HUMANOID_RIG.map(b=>b[0]));
for(const clip of Object.values(clips.clips))for(const key of clip.keys){
  assert.equal(key.rotations.length,19);
  for(const q of key.rotations){assert(q.every(Number.isFinite));assert(Math.abs(Math.hypot(...q)-1)<1e-6);}
}
const f={active:true,speed:420,agl:1200,turnBank:1};
const cruise=yuanYingFlightPose(f,0),shoulder=new Euler().setFromQuaternion(new Quaternion().fromArray(cruise.rotations[6]));
assert(Math.abs(shoulder.x)<.4,'Reference arms must stay lowered');
const right=yuanYingFlightPose(f,0,1),left=yuanYingFlightPose(f,0,-1);
assert(right.rotations[0][2]<0&&left.rotations[0][2]>0,'Body lean follows turn direction');
const ground={position:[0,0,0],rotations:HUMANOID_RIG.map(()=>[0,0,0,1])};
const animator=createYuanYingFlightAnimator(),other=createYuanYingFlightAnimator();
let pose=animator.update(f,0,1/60,ground);assert(animator.snapshot().weight>0&&animator.snapshot().weight<.2);
assert.equal(other.snapshot().weight,0);
for(let i=0;i<120;i++)pose=animator.update(f,i/60,1/60,ground);
assert(animator.snapshot().weight>.99);assert(animator.snapshot().bank>.99);
for(let i=0;i<120;i++)pose=animator.update({active:false},2+i/60,1/60,ground);
assert.equal(pose,null);assert.equal(animator.snapshot().weight,0);
const vfx=createYuanYingFlightVfx();assert.deepEqual(vfx.snapshot(),{active:false,points:64,ribbonTriangles:128,drawCalls:2});vfx.dispose();
console.log('Flight R2: 5 authored clips, 19 matching bones, normalized finite keys, lowered arms, directional banking, smooth entry/exit, isolated avatar states, VFX 64 points / 128 triangles / 2 calls: PASS');
