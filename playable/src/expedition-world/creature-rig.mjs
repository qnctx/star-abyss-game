import * as T from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { createContactPatches } from './creature-contact.mjs';
const DEATH_ROLL=Math.PI/2;
const collisionGeometryCache=new WeakMap();

/** A private skeleton per actor; immutable geometry/materials belong to the asset owner. */
export function createCreatureRig(template, rig, anchor, terrainHeight) {
  const visual=new T.Group();visual.name='creature-visual';let model,contacts;
  try {
  model=clone(template);visual.add(model);model.updateWorldMatrix(true,true);
  const meshes=[],bones=[];model.traverse(o=>{if(o.isSkinnedMesh){meshes.push(o);o.frustumCulled=false;o.receiveShadow=true;}if(o.isBone)bones.push(o);});
  const mesh=meshes[0];if(meshes.length!==1||!mesh)throw Error('Creature requires one authored skinned primitive');
  // UV/normal seams duplicate collision vertices. Preserve every distinct
  // position + skin influence; no decimation or approximate collision hull.
  const position=mesh.geometry.attributes.position,skinIndex=mesh.geometry.attributes.skinIndex,skinWeight=mesh.geometry.attributes.skinWeight;
  const exactSkin=!mesh.geometry.morphAttributes.position?.length;
  const cached=collisionGeometryCache.get(mesh.geometry),shared=cached?.bindMatrix.equals(mesh.bindMatrix)?cached:null;
  const unique=new Map(),fullIndices=shared?.fullIndices??[],boundPositions=shared?.boundPositions??new Float64Array(position.count*3),jointIndices=shared?.jointIndices??new Uint16Array(position.count*4),jointWeights=shared?.jointWeights??new Float64Array(position.count*4),skinMatrices=mesh.skeleton.bones.map(()=>new T.Matrix4()),skinPoint=new T.Vector3(),boundPoint=new T.Vector3();
  if(!shared)for(let i=0;i<position.count;i++){
    boundPoint.fromBufferAttribute(position,i).applyMatrix4(mesh.bindMatrix).toArray(boundPositions,i*3);
    for(let k=0;k<4;k++){jointIndices[i*4+k]=skinIndex.getComponent(i,k);jointWeights[i*4+k]=skinWeight.getComponent(i,k);}
    const key=[position.getX(i),position.getY(i),position.getZ(i),...Array.from({length:4},(_,k)=>skinIndex.getComponent(i,k)),...Array.from({length:4},(_,k)=>skinWeight.getComponent(i,k))].join(',');
    if(!exactSkin||!unique.has(key)){unique.set(key,i);fullIndices.push(i);}
  }
  if(!shared)collisionGeometryCache.set(mesh.geometry,{bindMatrix:mesh.bindMatrix.clone(),fullIndices,boundPositions,jointIndices,jointWeights});
  function vertexPosition(i,target){
    if(!exactSkin)return mesh.getVertexPosition(i,target).applyMatrix4(mesh.matrixWorld);
    boundPoint.fromArray(boundPositions,i*3);target.set(0,0,0);
    for(let k=0;k<4;k++){const weight=jointWeights[i*4+k];if(weight)target.addScaledVector(skinPoint.copy(boundPoint).applyMatrix4(skinMatrices[jointIndices[i*4+k]]),weight);}
    return target.applyMatrix4(mesh.bindMatrixInverse).applyMatrix4(mesh.matrixWorld);
  }
  const bind=new Map(bones.map(b=>[b,{p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}]));
  const node=name=>{const n=model.getObjectByName(name);if(!n)throw Error('Missing creature bone: '+name);return n;};
  const legs=Object.entries(rig.legs).map(([name,d])=>{
    const [upper,lower,foot]=d.chain.map(node),footQ=foot.getWorldQuaternion(new T.Quaternion());
    return {name,data:d,upper,lower,foot,footQ,indices:d.soleVertexIndices,
      a:new T.Vector3(...d.restHip).distanceTo(new T.Vector3(...d.restKnee)),b:new T.Vector3(...d.restKnee).distanceTo(new T.Vector3(...d.restAnkle)),target:new T.Vector3(),lift:0,clearance:0};
  });
  for(const leg of legs)if(!leg.indices.length||leg.indices.some(i=>!Number.isInteger(i)||i<0||i>=mesh.geometry.attributes.position.count))throw Error('Invalid sole vertex indices');
  contacts=createContactPatches(anchor,terrainHeight);const contactPoint=new T.Vector3();
  const stats={poseMs:0,footVertices:0,fullVertices:0,fullScans:0,cacheHits:0,collisionVertices:fullIndices.length,legs:[]};
  let previous=null,instance=null,lean=0,roll=0,gait=0,corpseKey=null,corpseY=0;
  const v=new T.Vector3(),hip=new T.Vector3(),knee=new T.Vector3(),axis=new T.Vector3(),pole=new T.Vector3(),cur=new T.Vector3(),dest=new T.Vector3();
  const q=new T.Quaternion(),parentQ=new T.Quaternion(),worldQ=new T.Quaternion(),xAxis=new T.Vector3(1,0,0),yAxis=new T.Vector3(0,1,0);
  function matrices(){visual.updateWorldMatrix(true,false);model.updateMatrixWorld(true);for(const m of meshes)m.skeleton.update();if(exactSkin)for(let i=0;i<skinMatrices.length;i++)skinMatrices[i].multiplyMatrices(mesh.skeleton.bones[i].matrixWorld,mesh.skeleton.boneInverses[i]);}
  function clearance(indices){
    let min=Infinity;
    if(indices){for(const i of indices){vertexPosition(i,v);const c=v.y-terrainHeight(v.x,v.z);if(c<min){min=c;contactPoint.copy(v);}}stats.footVertices+=indices.length;}
    else {for(const i of fullIndices){vertexPosition(i,v);const c=v.y-terrainHeight(v.x,v.z);if(c<min){min=c;contactPoint.copy(v);}stats.fullVertices++;}stats.fullScans++;}
    return min;
  }
  function aim(bone,child,target){
    bone.getWorldPosition(v);child.getWorldPosition(cur).sub(v).normalize();dest.copy(target).sub(v).normalize();
    q.setFromUnitVectors(cur,dest);bone.getWorldQuaternion(worldQ).premultiply(q);bone.parent.getWorldQuaternion(parentQ).invert();bone.quaternion.copy(parentQ.multiply(worldQ));bone.updateWorldMatrix(false,true);
  }
  function solve(leg){
    leg.upper.getWorldPosition(hip);axis.copy(leg.target).sub(hip);const length=axis.length(),d=Math.max(Math.abs(leg.a-leg.b)+1e-5,Math.min(leg.a+leg.b-1e-5,length));axis.normalize();
    pole.fromArray(leg.data.poleDirection).applyQuaternion(anchor.getWorldQuaternion(q));pole.addScaledVector(axis,-pole.dot(axis)).normalize();
    const along=(leg.a*leg.a-leg.b*leg.b+d*d)/(2*d),side=Math.sqrt(Math.max(0,leg.a*leg.a-along*along));
    knee.copy(hip).addScaledVector(axis,along).addScaledVector(pole,side);
    aim(leg.upper,leg.lower,knee);aim(leg.lower,leg.foot,leg.target);
    anchor.getWorldQuaternion(worldQ).multiply(leg.footQ).multiply(q.setFromAxisAngle(xAxis,(roll/DEATH_ROLL)*.35));leg.foot.parent.getWorldQuaternion(parentQ).invert();leg.foot.quaternion.copy(parentQ.multiply(worldQ));
    matrices();
  }
  function reset(){previous=null;corpseKey=null;}
  function update(view,time,animate=true){
    const start=performance.now();stats.footVertices=0;stats.fullVertices=0;stats.fullScans=0;stats.cacheHits=0;
    const identity=view.instanceId??view.id;if(identity!==instance){reset();instance=identity;}
    const dead=view.alive===false||view.hp<=0,resetPose=previous===null||!animate||time<previous,dt=resetPose?0:Math.min(.1,Math.max(0,time-previous));previous=time;
    const approach=(value,target,rate)=>{const n=resetPose?target:value+(target-value)*(1-Math.exp(-rate*dt));return Math.abs(n-target)<.0001?target:n;};
    lean=approach(lean,dead?0:view.phase==='windup'?-.18:view.phase==='attack'?.10:view.phase==='hurt'?.07:0,10);
    gait=approach(gait,!dead&&['chase','return','patrol'].includes(view.phase)?1:0,10);roll=approach(roll,dead?DEATH_ROLL:0,7);
    const key=[view.x,view.z,view.yaw,instance,lean,roll,gait].join(',');
    if(dead&&roll===DEATH_ROLL&&gait===0&&lean===0&&corpseKey===key){stats.cacheHits++;stats.poseMs=performance.now()-start;return;}
    contacts.hide();visual.position.y=0;visual.rotation.set(0,0,0);for(const [b,r] of bind){b.position.copy(r.p);b.quaternion.copy(r.q);b.scale.copy(r.s);}
    node('Chest').quaternion.multiply(q.setFromAxisAngle(xAxis,lean));
    const collapse=roll/DEATH_ROLL;
    node('Spine').quaternion.multiply(q.setFromAxisAngle(xAxis,.10*collapse));
    node('Neck').quaternion.multiply(q.setFromAxisAngle(xAxis,-.16*collapse));
    node('Tail01').quaternion.multiply(q.setFromAxisAngle(yAxis,.20*collapse));
    // Small authored-bone breathing/tail motion; no root motion or gameplay clock.
    if(!dead&&roll===0){node('Neck').quaternion.multiply(q.setFromAxisAngle(xAxis,Math.sin(time*1.6)*.012));node('Tail01').quaternion.multiply(q.setFromAxisAngle(yAxis,Math.sin(time*2)*.025));}
    matrices();
    let crouch=0;
    for(const leg of legs){
      const cycle=time*9+(['RF','LH'].includes(leg.name)?Math.PI:0),swing=Math.max(0,Math.sin(cycle));leg.lift=gait*swing*.065;
      leg.target.fromArray(leg.data.restAnkle);leg.target.z+=Math.cos(cycle)*.10*gait;
      anchor.localToWorld(leg.target);leg.target.y+=terrainHeight(leg.target.x,leg.target.z)-anchor.position.y+leg.lift;
      if(collapse>0){const front=leg.name.endsWith('F'),side=leg.name.startsWith('L')?-1:1;
        // Bring paws toward the belly as elbows/hocks fold; the flank, not an
        // extended lower paw, can then support the sideways torso.
        dest.set(side*(front?.12:.15),front?.57:.59,front?-.38:.40);anchor.localToWorld(dest);leg.target.lerp(dest,collapse);
      }
      leg.upper.getWorldPosition(hip);const horizontal=(hip.x-leg.target.x)**2+(hip.z-leg.target.z)**2;
      const reach=Math.sqrt(Math.max(0,(leg.a+leg.b-.025)**2-horizontal));crouch=Math.max(crouch,hip.y-leg.target.y-reach);
    }
    // Lower the pelvis only enough to keep downhill feet reachable; never stretch bones.
    node('Pelvis').position.y-=Math.min(.18,crouch+.015);matrices();
    for(const leg of legs){
      // Correct measured deformed sole, not the bind-pose positions or an ankle marker.
      for(let iteration=0;iteration<3;iteration++){solve(leg);leg.clearance=clearance(leg.indices);if(collapse>0||Math.abs(leg.clearance-leg.lift)<.001)break;leg.target.y+=leg.lift-leg.clearance;}
      if(!dead&&roll===0&&leg.lift<.001&&Math.abs(leg.clearance)<.003)contacts.put(legs.indexOf(leg),contactPoint,{lift:0});
    }
    if(dead||roll>0){
      cur.set(0,0,-.75);dest.set(0,0,.75);anchor.localToWorld(cur);anchor.localToWorld(dest);
      // The shoulder armour is wider than the hips: a slight rearward settle
      // brings the pelvis down instead of balancing the whole body on the neck.
      visual.rotation.x=(.12-Math.atan2(terrainHeight(dest.x,dest.z)-terrainHeight(cur.x,cur.z),1.5))*collapse;
      visual.rotation.z=roll;matrices();corpseY=-clearance();visual.position.y=corpseY;matrices();contacts.put(4,contactPoint,{corpse:true});corpseKey=key;
    }else corpseKey=null;
    stats.legs=legs.map(l=>({name:l.name,lift:l.lift,clearance:l.clearance,mode:dead||roll>0?'corpse':l.lift>.0001?'swing':'stance'}));stats.poseMs=performance.now()-start;
  }
  anchor.add(visual);
  let released=false;
  return {visual,model,mesh,legs,stats,update,reset,contacts,mount(nextAnchor){anchor=nextAnchor;anchor.add(visual);contacts.mount(anchor);},dispose(){if(released)return;released=true;contacts.dispose();const skeletons=new Set(meshes.map(m=>m.skeleton));skeletons.forEach(s=>s.dispose());anchor.remove(visual);}};
  } catch(error) {
    contacts?.dispose();const skeletons=new Set();model?.traverse(o=>{if(o.skeleton)skeletons.add(o.skeleton);});skeletons.forEach(s=>s.dispose());anchor.remove(visual);throw error;
  }
}
