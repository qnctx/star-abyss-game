import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const ids=['qi-boost','aerial-crescent','blink-aperture','domain-gate','void-fracture','dao-gate'];
// Reference-built GLBs: fixed pools, shared geometry, no dynamic light or shadow.
export function createAscensionEffects(scene,{loadAsset}={}){
 const root=new THREE.Group();root.name='ascension-r8-effects';scene.add(root);
 const pools=new Map(),errors=[],loader=new GLTFLoader(),active=[],seen=new Set();
 let ready=false,lastBlink='',boost=null;
 const promise=Promise.all(ids.map(async id=>{
  try{const gltf=await (loadAsset?loadAsset(id):loader.loadAsync('./assets/ascension-r8/'+id+'.glb')),list=[];
   for(let i=0;i<(id==='qi-boost'?1:id==='aerial-crescent'?6:4);i++){
    const object=gltf.scene.clone(true),materials=[];object.name='ascension-'+id+'-'+i;
    object.traverse(mesh=>{if(!mesh.isMesh)return;mesh.castShadow=mesh.receiveShadow=false;const make=m=>{const clone=m.clone();clone.transparent=true;clone.depthWrite=false;clone.userData.baseOpacity=clone.opacity;clone.userData.originalColor=clone.color?.clone();clone.userData.originalEmissive=clone.emissive?.clone();materials.push(clone);return clone;};mesh.material=Array.isArray(mesh.material)?mesh.material.map(make):make(mesh.material);});
    object.visible=false;root.add(object);list.push({id,object,materials,busy:false});
   }pools.set(id,list);
  }catch(error){errors.push(id+': '+error.message);}
 })).then(()=>{ready=errors.length===0;boost=pools.get('qi-boost')?.[0];});
 function fade(item,alpha){for(const m of item.materials)m.opacity=(m.userData.baseOpacity??1)*alpha;}
 function spawn(id,position,{time,yaw=0,scale=1,duration=.9,direction=null,travel=0,flightDuration=duration,castId=null,hostile=false}={}){
  const item=pools.get(id)?.find(p=>!p.busy);if(!item)return false;
  item.busy=true;Object.assign(item,{start:time,duration,baseScale:scale,travel,flightDuration,castId,direction:direction?new THREE.Vector3(direction.x,direction.y,direction.z):null,origin:new THREE.Vector3(position.x,position.y,position.z)});
  for(const m of item.materials){if(hostile){m.color?.set(0xff4520);m.emissive?.set(0xff2010);}else{if(m.userData.originalColor)m.color.copy(m.userData.originalColor);if(m.userData.originalEmissive)m.emissive.copy(m.userData.originalEmissive);}}
  item.object.position.copy(item.origin);item.object.rotation.set(0,yaw,0);if(direction)item.object.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),item.direction.clone().normalize());item.object.scale.setScalar(scale);item.object.visible=true;fade(item,0);active.push(item);return true;
 }
 function update({flight,blink,combat,time=0,player,cameraMode='first',avatar}){
  root.visible=!!player;
  if(boost){boost.object.visible=!!flight?.active&&flight.boosting===true&&cameraMode!=='first';if(boost.object.visible){const pelvis=avatar.getObjectByName?.('c2-native-pelvis')||avatar.getObjectByName?.('explorer-pelvis');if(pelvis){pelvis.getWorldPosition(boost.object.position);pelvis.getWorldQuaternion(boost.object.quaternion);}else{boost.object.position.copy(avatar.position);boost.object.position.y+=.9;boost.object.quaternion.copy(avatar.quaternion);}boost.object.rotateY(time*2.5);boost.object.scale.set(.8,1.15,.8);fade(boost,.65);}}
  if(!blink)lastBlink='';
  if(blink&&ready){const key=JSON.stringify([blink.serial,blink.realm,blink.from,blink.to]);if(key!==lastBlink){lastBlink=key;const id=blink.realm>=9?'dao-gate':blink.realm>=7?'domain-gate':'blink-aperture';for(const p of [blink.from,blink.to])spawn(id,{...p,y:p.y+1},{time,yaw:blink.yaw,duration:1.05,scale:blink.mode==='long'?1.15:.8});}}
  const casts=combat?.aerialCasts||[],present=new Set(casts.map(c=>c.id));
  if(ready)for(const cast of casts){
   if(seen.has(cast.id)||!cast.origin||cast.resolved)continue;
   const hostile=cast.kind==='scavenger-bolt',rank=cast.realm||4,rift=!hostile&&rank>=6;
   const id=hostile?'aerial-crescent':rank>=9?'dao-gate':rank>=8?'void-fracture':rank>=6?'domain-gate':'aerial-crescent';
   const direction=cast.direction,span=Math.hypot(cast.aim.x-cast.origin.x,cast.aim.y-cast.origin.y,cast.aim.z-cast.origin.z);
   // Blades reach the locked point at authoritative release; rifts charge at that point.
   const offset=Math.min(3,span),position=rift?cast.aim:{x:cast.origin.x+direction.x*offset,y:cast.origin.y+direction.y*offset,z:cast.origin.z+direction.z*offset};
   if(spawn(id,position,{time:cast.start,scale:hostile?.6:rank>=8?1.3:.75,duration:Math.max(.1,cast.end-cast.start),flightDuration:Math.max(.01,cast.release-cast.start),direction,travel:rift?0:Math.max(0,span-offset),castId:cast.id,hostile})){seen.add(cast.id);if(seen.size>100)seen.delete(seen.values().next().value);}
  }
  for(let i=active.length-1;i>=0;i--){
   const item=active[i],age=(item.castId?combat?.time??item.start:time)-item.start,t=Math.max(0,age/item.duration);
   if(t>=1||age<0||item.castId&&!present.has(item.castId)){item.object.visible=false;item.busy=false;active.splice(i,1);continue;}
   item.object.visible=!item.castId||combat?.screen==='playing';
   const progress=Math.min(1,Math.max(0,age/item.flightDuration)),after=Math.max(0,(age-item.flightDuration)/Math.max(.1,item.duration-item.flightDuration));
   item.object.position.copy(item.origin);if(item.direction)item.object.position.addScaledVector(item.direction,item.travel*progress);
   item.object.scale.setScalar(item.baseScale*(item.castId?.45+.55*progress:.65+Math.min(.6,t*1.5)));
   const alpha=item.castId?Math.min(1,age*12)*(1-after):Math.min(1,t*12)*(1-Math.max(0,(t-.6)/.4));fade(item,alpha);
  }
 }
 return {root,ready:promise,update,snapshot:()=>({ready,errors:[...errors],assets:[...pools.keys()],active:active.map(a=>a.id),boostVisible:!!boost?.object.visible}),dispose(){scene.remove(root);const geometries=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});for(const g of geometries)g.dispose();for(const list of pools.values())for(const item of list)for(const m of item.materials)m.dispose();}};
}
