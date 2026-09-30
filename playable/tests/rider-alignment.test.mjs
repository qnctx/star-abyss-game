import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {seatedVehiclePose} from '../src/tactical-pose.mjs';
import {forwardPose} from '../src/authored-motion.mjs';
import {gripAnchor,applyMountedVehicleView,VEHICLE_RIG} from '../src/vehicle-rig.mjs';
import {HUMANOID_RIG} from '../src/humanoid-rig.mjs';
import {createCharacterRetarget} from '../src/character-retarget.mjs';
import data from '../assets/characters/c2-explorer-data.mjs';
test('rider wrists track both physical grips for straight and both steering locks',()=>{
 for(const angle of [-.22,0,.22]){
 const fk=forwardPose(seatedVehiclePose(angle));
 for(const [i,side]of [[8,-1],[12,1]]){
 const palm=fk.positions[i].clone().add(new THREE.Vector3(0,-.06,0).applyQuaternion(fk.rotations[i]));
 assert.ok(palm.distanceTo(gripAnchor(side,angle))<1e-8,`palm ${angle} ${side}: ${palm.distanceTo(gripAnchor(side,angle))}`);
 }
 }
});
test('same rider transform and eye survive slope and remote spherical support, independent of look',()=>{
 for(const euler of [[0,0,0],[.6,1.1,.3],[1.8,2.1,-.7]]){
 const skimmer={root:new THREE.Group()},avatar={root:new THREE.Group(),eyePosition:()=>null},camera=new THREE.PerspectiveCamera();
 skimmer.root.position.set(400,200,-900);skimmer.root.rotation.set(...euler);
 const view={cameraMode:'vehicle-first',player:{yaw:.4,pitch:-.2},mobility:{vehicle:{mounted:true,yaw:.4}}},cameraState={};
 applyMountedVehicleView({avatar,skimmer,camera,view,cameraState});
 const local=camera.position.clone().sub(skimmer.root.position).applyQuaternion(skimmer.root.quaternion.clone().invert());
 assert.ok(local.distanceTo(new THREE.Vector3(...VEHICLE_RIG.eye).add(new THREE.Vector3(0,VEHICLE_RIG.hullLift,0)))<1e-10);
 const before=camera.position.clone();view.player.yaw=1.3;applyMountedVehicleView({avatar,skimmer,camera,view,cameraState});assert.ok(camera.position.distanceTo(before)<1e-10);
 assert.ok(avatar.root.quaternion.angleTo(skimmer.root.quaternion)<1e-7);assert.equal(avatar.root.visible,true);
 }
});
test('original GLB native rig reaches mounted wrist targets without replacing artwork',()=>{
 const b=Buffer.from(data.split(',').pop(),'base64'),json=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
 const rig=JSON.parse(json.nodes.find(n=>n.extras?.c2NativeRig).extras.c2NativeRig);
 for(const angle of [-.22,0,.22]){
 const root=new THREE.Group(),pose=seatedVehiclePose(angle),bones=HUMANOID_RIG.map(([name,parent,p],i)=>{const bone=new THREE.Bone();bone.position.fromArray(p);bone.quaternion.copy(pose.rotations[i]);return bone;});
 HUMANOID_RIG.forEach(([,parent],i)=>(parent<0?root:bones[parent]).add(bones[i]));bones[0].position.add(new THREE.Vector3(...pose.position));
 const retarget=createCharacterRetarget(root,{bones},rig.positions);retarget.update({mounted:true});
 for(const [i,side] of [[8,-1],[12,1]]){const palm=retarget.skeleton.bones[i].localToWorld(new THREE.Vector3(0,-.12,-.035));assert.ok(palm.distanceTo(gripAnchor(side,angle))<1e-6);}
 assert.ok(retarget.report.maxReachError<1e-6);retarget.dispose();
 }
});
