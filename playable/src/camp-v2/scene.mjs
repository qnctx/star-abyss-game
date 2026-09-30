import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {terrainHeight} from '../layout.mjs';
import {installCampCollision} from '../foundation/camp-collision.mjs';
import {CAMP_V2_BUILDINGS} from './layout.mjs';

/** Loads the authored GLBs. Their own triangles provide walls, open doors, stairs and foot support. */
export function createCampV2Scene({scene,ground=terrainHeight,loadAsset,onChange=()=>{}}){
 const group=new THREE.Group();group.name='camp-v2-buildings';group.visible=false;scene.add(group);
 const loader=new GLTFLoader(),placed=new Map(),raycaster=new THREE.Raycaster(),buildingStatus=Object.fromEntries(CAMP_V2_BUILDINGS.map(def=>[def.id,{status:'loading',error:''}]));let status='loading',error='',disposed=false,collision=null;
 const ready=Promise.all(CAMP_V2_BUILDINGS.map(async def=>{
  try{const gltf=loadAsset?await loadAsset(def.asset,def.id):await loader.loadAsync(def.asset);
   if(!gltf?.scene?.isObject3D)throw Error(`${def.id} GLB 缺少场景`);
   buildingStatus[def.id]={status:'loaded',error:''};return {def,gltf};
  }catch(cause){buildingStatus[def.id]={status:'failed',error:String(cause?.message||cause)};throw cause;}
 })).then(loaded=>{
  if(disposed)return {status:'disposed'};
  for(const {def,gltf} of loaded){
   const root=new THREE.Group();root.name=`camp-v2-${def.id}`;root.add(gltf.scene);root.rotation.y=def.yaw;
   const bounds=new THREE.Box3().setFromObject(root);if(!Number.isFinite(bounds.min.y)||bounds.isEmpty())throw Error(`${def.id} GLB 无有效几何`);
   root.position.set(def.x,ground(def.x,def.z)-bounds.min.y,def.z);
   root.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}});
   group.add(root);placed.set(def.id,root);buildingStatus[def.id]={status:'ready',error:''};
  }
  group.updateMatrixWorld(true);collision=installCampCollision([...placed.values()]);
  status='ready';group.visible=true;onChange();return {status};
 }).catch(cause=>{collision?.destroy();collision=null;group.visible=false;status='failed';error=String(cause?.message||cause);onChange();return {status,error};});
 function hasLineOfSight(a,b){if(status!=='ready'||!group.visible)return true;
  const from=new THREE.Vector3(a.x,Number.isFinite(a.y)?a.y:ground(a.x,a.z)+1,a.z),to=new THREE.Vector3(b.x,Number.isFinite(b.y)?b.y:ground(b.x,b.z)+1,b.z),delta=to.clone().sub(from),distance=delta.length();if(distance<.2)return true;
  for(const [start,direction] of [[from,delta],[to,delta.clone().negate()]]){raycaster.set(start,direction.normalize());raycaster.near=.08;raycaster.far=distance-.08;if(raycaster.intersectObjects([...placed.values()],true).length)return false;}
  return true;
 }
 return {group,ready,hasLineOfSight,get assetStatus(){return status;},get error(){return error;},get buildings(){return placed;},get buildingStatus(){return structuredClone(buildingStatus);},
  update({visible=true}={}){const next=status==='ready'&&visible;if(group.visible!==next){group.visible=next;onChange();}collision?.setEnabled(next);},
  destroy(){disposed=true;collision?.destroy();group.removeFromParent();group.traverse(object=>{if(!object.isMesh)return;object.geometry?.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material]){if(!material)continue;for(const value of Object.values(material))if(value?.isTexture)value.dispose();material.dispose();}});placed.clear();onChange();}};
}
