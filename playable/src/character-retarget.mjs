import * as THREE from 'three';
import {HUMANOID_RIG} from './humanoid-rig.mjs';
import {forwardFeet,restingPose} from './authored-motion.mjs';
const idleFeet=forwardFeet(restingPose('idle',0)).feet;

/** Keep authored joint spacing and bind-space geometry; transfer motion only. */
export function createCharacterRetarget(root,driver,positions){
  if(positions.length!==HUMANOID_RIG.length||positions.some(p=>p.length!==3||!p.every(Number.isFinite)))throw new Error('Invalid native character rig');
  const rest=positions.map(p=>new THREE.Vector3(...p));
  const canonical=[];
  const bones=HUMANOID_RIG.map(([name,parent,p],i)=>{
    canonical[i]=new THREE.Vector3(...p).add(parent<0?new THREE.Vector3():canonical[parent]);
    const bone=new THREE.Bone();bone.name=`c2-native-${name}`;
    bone.position.copy(rest[i]);if(parent>=0)bone.position.sub(rest[parent]);return bone;
  });
  HUMANOID_RIG.forEach(([,parent],i)=>(parent<0?root:bones[parent]).add(bones[i]));
  root.updateMatrixWorld(true);
  // Inverses are defined in avatar-local bind space, independent of load timing.
  const inverses=rest.map(p=>new THREE.Matrix4().makeTranslation(-p.x,-p.y,-p.z));
  const skeleton=new THREE.Skeleton(bones,inverses);
  const rootInverse=new THREE.Matrix4(),rootQ=new THREE.Quaternion();
  const localPoint=bone=>bone.getWorldPosition(new THREE.Vector3()).applyMatrix4(rootInverse);
  const localRotation=bone=>bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(rootQ.clone().invert());
  const setLocalWorldRotation=(bone,q)=>{
    const parent=bone.parent===root?new THREE.Quaternion():localRotation(bone.parent);
    bone.quaternion.copy(parent.invert().multiply(q));
  };
  const report={mode:'native-bind-motion-retarget',jointCount:bones.length,maxReachError:0};
  function update({prone=false,proneBlend=prone?1:0,mounted=false}={}){
    root.updateMatrixWorld(true);rootInverse.copy(root.matrixWorld).invert();root.getWorldQuaternion(rootQ);
    bones.forEach((bone,i)=>bone.quaternion.copy(driver.bones[i].quaternion));
    bones[0].position.copy(rest[0]).add(driver.bones[0].position.clone().sub(canonical[0]));
    bones[0].position.y+=(canonical[0].y-rest[0].y)*proneBlend;
    if(mounted)bones[0].position.copy(driver.bones[0].position);
    root.updateMatrixWorld(true);
    // Generated bind arms are already angled out. Remove that bind angle before
    // applying the licensed motion, otherwise idle doubles the arm abduction.
    for(const shoulder of [6,10]){
      for(const [i,child] of [[shoulder,shoulder+1],[shoulder+1,shoulder+2],[shoulder+2,shoulder+2]]){
        const direction=child===i?rest[i].clone().sub(rest[i-1]):rest[child].clone().sub(rest[i]);
        const alignment=new THREE.Quaternion().setFromUnitVectors(direction.normalize(),new THREE.Vector3(0,-1,0));
        setLocalWorldRotation(bones[i],localRotation(driver.bones[i]).multiply(alignment));root.updateMatrixWorld(true);
      }
    }
    report.maxReachError=0;
    if(prone||mounted){
      for(const start of [6,10,13,16]){
        const mid=start+1,end=start+2,arm=start<13,h=localPoint(bones[start]),k=localPoint(bones[mid]),a=localPoint(bones[end]);
        const upper=rest[mid].distanceTo(rest[start]),lower=rest[end].distanceTo(rest[mid]),ratio=(upper+lower)/(arm?.577:.89);
        const target=localPoint(driver.bones[end]),hint=localPoint(driver.bones[mid]);
        if(mounted&&arm){
          // The authored glove is longer than the canonical driver hand. Anchor
          // its palm volume, not just its wrist joint, to the same physical grip.
          target.add(new THREE.Vector3(0,-.06,0).applyQuaternion(localRotation(driver.bones[end])));
          target.sub(new THREE.Vector3(0,-.12,-.035).applyQuaternion(localRotation(bones[end])));
        }
        if(!arm&&!mounted){target.z*=ratio;hint.z*=ratio;}
        target.lerpVectors(a,target,mounted?1:proneBlend);
        const axis=target.clone().sub(h),raw=axis.length(),distance=THREE.MathUtils.clamp(raw,Math.abs(upper-lower)+.001,upper+lower-.001);axis.normalize();
        const pole=hint.sub(h);pole.addScaledVector(axis,-pole.dot(axis));if(pole.lengthSq()<1e-8)pole.set(start===6||start===13?-1:1,0,0);pole.normalize();
        const along=(upper*upper-lower*lower+distance*distance)/(2*distance),bend=Math.sqrt(Math.max(0,upper*upper-along*along));
        const nextK=h.clone().addScaledVector(axis,along).addScaledVector(pole,bend),nextA=h.clone().addScaledVector(axis,distance);
        const q1=localRotation(bones[start]),q2=localRotation(bones[mid]),endQ=localRotation(bones[end]);
        q1.premultiply(new THREE.Quaternion().setFromUnitVectors(k.clone().sub(h).normalize(),nextK.clone().sub(h).normalize()));q2.premultiply(new THREE.Quaternion().setFromUnitVectors(a.clone().sub(k).normalize(),nextA.clone().sub(nextK).normalize()));
        setLocalWorldRotation(bones[start],q1);root.updateMatrixWorld(true);setLocalWorldRotation(bones[mid],q2);root.updateMatrixWorld(true);setLocalWorldRotation(bones[end],endQ);root.updateMatrixWorld(true);
        report.maxReachError=Math.max(report.maxReachError,raw-distance);
      }
      report.proneJoints=[0,4,7,8,11,12,14,15,17,18].map(i=>({name:HUMANOID_RIG[i][0],position:localPoint(bones[i]).toArray()}));
      if(mounted)report.mountedJoints=report.proneJoints;
      return report;
    }
    for(const hip of [13,16]){
      const knee=hip+1,ankle=hip+2;
      const h=localPoint(bones[hip]),k=localPoint(bones[knee]),a=localPoint(bones[ankle]);
      const target=localPoint(driver.bones[ankle]).add(rest[ankle].clone().sub(canonical[ankle]));
      target.x+=canonical[ankle].x-idleFeet[hip===13?0:1].ankle.x;
      const axis=target.clone().sub(h),raw=axis.length();
      const upper=rest[knee].distanceTo(rest[hip]),lower=rest[ankle].distanceTo(rest[knee]);
      const distance=THREE.MathUtils.clamp(raw,Math.abs(upper-lower)+.001,upper+lower-.001);axis.normalize();
      const pole=localPoint(driver.bones[knee]).sub(localPoint(driver.bones[hip]));
      pole.addScaledVector(axis,-pole.dot(axis));
      if(pole.lengthSq()<1e-8)pole.set(0,0,-1).addScaledVector(axis,axis.z);
      pole.normalize();
      const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
      const bend=Math.sqrt(Math.max(0,upper*upper-along*along));
      const nextK=h.clone().addScaledVector(axis,along).addScaledVector(pole,bend);
      const nextA=h.clone().addScaledVector(axis,distance);
      const hipQ=localRotation(bones[hip]),kneeQ=localRotation(bones[knee]);
      hipQ.premultiply(new THREE.Quaternion().setFromUnitVectors(k.clone().sub(h).normalize(),nextK.clone().sub(h).normalize()));
      kneeQ.premultiply(new THREE.Quaternion().setFromUnitVectors(a.clone().sub(k).normalize(),nextA.clone().sub(nextK).normalize()));
      setLocalWorldRotation(bones[hip],hipQ);root.updateMatrixWorld(true);
      setLocalWorldRotation(bones[knee],kneeQ);root.updateMatrixWorld(true);
      setLocalWorldRotation(bones[ankle],localRotation(driver.bones[ankle]));root.updateMatrixWorld(true);
      report.maxReachError=Math.max(report.maxReachError,raw-distance);
    }
    return report;
  }
  return {skeleton,update,report,eyePosition(){return bones[4].localToWorld(new THREE.Vector3(0,.07,-.11));},dispose(){root.remove(bones[0]);skeleton.dispose();}};
}
