import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {HUMANOID_RIG} from '../src/humanoid-rig.mjs';
import {createCharacterRetarget} from '../src/character-retarget.mjs';
import {sampleClip} from '../src/authored-motion.mjs';

function fixture(){
  const root=new THREE.Group();root.position.set(13,2,-9);root.rotation.y=.9;
  const absolute=[],bones=HUMANOID_RIG.map(([name,parent,p],i)=>{
    absolute[i]=new THREE.Vector3(...p).add(parent<0?new THREE.Vector3():absolute[parent]);
    const b=new THREE.Bone();b.name=name;b.position.fromArray(p);return b;
  });
  HUMANOID_RIG.forEach(([,parent],i)=>(parent<0?root:bones[parent]).add(bones[i]));
  const driver=new THREE.Skeleton(bones);
  const positions=absolute.map(p=>[p.x*1.2,.14+(p.y-.12)*.93,p.z]);
  const retarget=createCharacterRetarget(root,driver,positions);
  return {root,driver,positions,retarget};
}
test('native bind preserves geometry when avatar loads away from world origin',()=>{
  const {root,positions,retarget}=fixture();root.updateMatrixWorld(true);
  const inverse=root.matrixWorld.clone().invert(),point=new THREE.Vector3(.17,1.2,-.1);
  retarget.skeleton.bones.forEach((b,i)=>{
    const result=point.clone().applyMatrix4(retarget.skeleton.boneInverses[i]).applyMatrix4(b.matrixWorld).applyMatrix4(inverse);
    assert.ok(result.distanceTo(point)<1e-10);
    assert.ok(b.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse).distanceTo(new THREE.Vector3(...positions[i]))<1e-10);
  });
  retarget.dispose();
});
test('motion transfer keeps authored bone lengths throughout walk and sprint',()=>{
  const {root,driver,retarget}=fixture();
  const lengths=retarget.skeleton.bones.map(b=>b.position.length());
  for(const name of ['walk','sprint'])for(let frame=0;frame<30;frame++){
    const pose=sampleClip(name,frame/30);
    driver.bones.forEach((b,i)=>b.quaternion.copy(pose.rotations[i]));
    driver.bones[0].position.fromArray(HUMANOID_RIG[0][2]).add(new THREE.Vector3(...pose.position));
    root.updateMatrixWorld(true);retarget.update();
    retarget.skeleton.bones.forEach((b,i)=>{
      assert.ok(b.quaternion.toArray().every(Number.isFinite));
      assert.ok(Math.abs(b.quaternion.length()-1)<1e-8);
      if(i)assert.ok(Math.abs(b.position.length()-lengths[i])<1e-10);
    });
  }
  retarget.dispose();
});
