// Reuse the actual game's retarget instead of approximating native C2 joints.
import fs from 'node:fs';
import * as THREE from 'three';
import {HUMANOID_RIG} from '../../../playable/src/humanoid-rig.mjs';
import {createCharacterRetarget} from '../../../playable/src/character-retarget.mjs';
import {sampleAirCombatPose,AIR_COMBAT_CLIPS} from '../../../playable/src/air-combat-pose.mjs';
const out=new URL('../../../playable/assets/air-combat-r9/',import.meta.url);
const native=JSON.parse(fs.readFileSync(new URL('native-rig.json',out),'utf8'));
const root=new THREE.Group();const bones=HUMANOID_RIG.map(([name,parent,p])=>{const b=new THREE.Bone();b.name=name;b.position.fromArray(p);return b;});
HUMANOID_RIG.forEach(([,parent],i)=>(parent<0?root:bones[parent]).add(bones[i]));root.updateMatrixWorld(true);
const driver=new THREE.Skeleton(bones),retarget=createCharacterRetarget(root,driver,native.positions);const clips={},checks={};
for(const id of Object.keys(AIR_COMBAT_CLIPS)){
 const keys=[];
 for(let frame=0;frame<=100;frame++){
  const progress=frame/100,pose=sampleAirCombatPose(id,progress);
  bones.forEach((b,i)=>{b.position.fromArray(HUMANOID_RIG[i][2]);b.quaternion.fromArray(pose.rotations[i]);});bones[0].position.add(new THREE.Vector3(...pose.position));root.updateMatrixWorld(true);retarget.update();
  keys.push({progress,position:retarget.skeleton.bones[0].position.clone().sub(new THREE.Vector3(...native.positions[0])).toArray(),rotations:retarget.skeleton.bones.map(b=>b.quaternion.toArray())});
  if(Math.abs(progress-AIR_COMBAT_CLIPS[id].peak)<.0001){
   const world=i=>retarget.skeleton.bones[i].getWorldPosition(new THREE.Vector3()).toArray();
   checks[id]={pelvis:world(0),head:world(4),wristL:world(8),wristR:world(12),hipL:world(13),hipR:world(16),kneeL:world(14),kneeR:world(17),ankleL:world(15),ankleR:world(18)};
  }
 }
 clips[id]={keys};
}
fs.writeFileSync(new URL('native-clips.json',out),JSON.stringify({source:'actual createCharacterRetarget()',clips},null,2));
fs.writeFileSync(new URL('../../../docs/art/air-combat-r9/native-joint-checks.json',import.meta.url),JSON.stringify(checks,null,2));
console.log('Actual C2 native retarget baked: 8 clips x 101 normalized samples');
