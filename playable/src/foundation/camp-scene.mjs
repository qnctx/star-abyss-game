import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {terrainHeight,supportHeight} from '../layout.mjs';
import {PHYSICIAN} from './camp-data.mjs';
import {CAMP_ASSETS_READY,CAMP_ASSET_FILES} from './camp-assets.mjs';
import {installCampCollision} from './camp-collision.mjs';
import {createCampActivity,installCampActorCollision} from '../camp-v2/activity.mjs';
import {createNPCRig} from '../progression-quests/npc-rig.mjs';
export function setPhysicianLook(head,baseYaw,relativeYaw){head.rotation.y=baseYaw+THREE.MathUtils.clamp(Math.atan2(Math.sin(relativeYaw),Math.cos(relativeYaw)),-.6,.6)*.75;}
function updateSkinMatrices(root){root.updateMatrixWorld(true);root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});}

/** Offset a wrapper, preserving any authored transform on the GLB scene root. */
export function placeCampAsset(gltf,{height,x,z,yaw=0,ground=terrainHeight,group}={}){
  const wrapper=new THREE.Group();wrapper.add(gltf.scene);updateSkinMatrices(wrapper);
  const bounds=new THREE.Box3().setFromObject(wrapper),size=bounds.getSize(new THREE.Vector3());
  if(!Number.isFinite(size.y)||size.y<=0)throw Error('医务模型尺寸无效');
  wrapper.scale.setScalar(height/size.y);updateSkinMatrices(wrapper);
  const fitted=new THREE.Box3().setFromObject(wrapper),center=fitted.getCenter(new THREE.Vector3());
  wrapper.position.set(-center.x,-fitted.min.y,-center.z);
  const root=new THREE.Group();root.add(wrapper);root.position.set(x,ground(x,z),z);root.rotation.y=yaw;
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});group?.add(root);updateSkinMatrices(root);return root;
}

/** Real GLB assets only: missing assets hide this slice instead of rendering proxy people. */
export function createCampScene({scene,assetBase='assets/foundation/',foundationReady=Promise.resolve(),onChange=()=>{}}={}){
  const group=new THREE.Group();group.name='dawn-camp-medicine';group.visible=false;scene.add(group);
  const loader=new GLTFLoader(),activity=createCampActivity('N02');let disposed=false,status='loading',error='',physician=null,physicianRig=null,bench=null,vial=null,collision=null,actorCollision=null;
  const ground=(x,z)=>supportHeight(x,z,0,terrainHeight(x,z)+1.15);
  function place(gltf,height,x,z,yaw=0){
    return placeCampAsset(gltf,{height,x,z,yaw,ground,group});
  }
  const ready=!CAMP_ASSETS_READY?(status='not-generated',Promise.resolve({status})):foundationReady.then(()=>Promise.all(CAMP_ASSET_FILES.map(file=>loader.loadAsync(assetBase+file)))).then(([npc,station,medicine])=>{
    if(disposed)return {status:'disposed'};physicianRig=createNPCRig(npc,{height:1.72});physician=physicianRig.root;physician.name='camp-physician-N02';physician.position.set(PHYSICIAN.x,ground(PHYSICIAN.x,PHYSICIAN.z),PHYSICIAN.z);physician.rotation.y=PHYSICIAN.yaw;group.add(physician);activity.position.y=physician.position.y;bench=place(station,1.65,5.7,174.2,Math.PI/2);
    bench.updateWorldMatrix(true,true);const point=bench.localToWorld(new THREE.Vector3(-.65,2.2,.35));
    const hit=new THREE.Raycaster(point,new THREE.Vector3(0,-1,0),0,3).intersectObject(bench,true)[0];
    if(!hit)throw Error('药瓶下方没有真实医务台表面');
    vial=place(medicine,.14,point.x,point.z);vial.position.y=hit.point.y+.002;
    updateSkinMatrices(physician);collision=installCampCollision([bench]);actorCollision=installCampActorCollision(()=>activity.position);status='ready';group.visible=true;onChange();return {status};
  }).catch(e=>{collision?.destroy();actorCollision?.destroy();collision=null;actorCollision=null;status='failed';error=String(e.message||e);group.visible=false;return {status,error};});
  return {group,ready,get assetStatus(){return status;},get error(){return error;},get position(){return status==='ready'?{...activity.position,radius:PHYSICIAN.radius,id:'N02'}:null;},get collisionMeshes(){return status==='ready'?[physician,bench]:[];},get collisionBoxes(){return status==='ready'?[physician,bench].map(object=>{object.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(object);return {minX:b.min.x,maxX:b.max.x,minY:b.min.y,maxY:b.max.y,minZ:b.min.z,maxZ:b.max.z};}):[];},update({time=0,dt=0,player=null,visible=true,dialogOpen=false}={}){
    const wasVisible=group.visible;group.visible=status==='ready'&&visible;if(wasVisible!==group.visible)onChange();
    collision?.setEnabled(group.visible);actorCollision?.setEnabled(group.visible);
    if(vial)vial.visible=group.visible;
    if(physicianRig&&group.visible){const before={...activity.position},position=activity.update(dt,{player,paused:dialogOpen,ground}),distance=Math.hypot(position.x-before.x,position.z-before.z),speed=dt>0?distance/dt:0;let turn=0;if(distance>.0001){const target=Math.atan2(position.x-before.x,position.z-before.z),change=Math.atan2(Math.sin(target-physician.rotation.y),Math.cos(target-physician.rotation.y)),step=Math.sign(change)*Math.min(Math.abs(change),Math.max(0,dt)*2.4);physician.rotation.y+=step;turn=dt>0?step/dt:0;}physician.position.set(position.x,position.y,position.z);const lookYaw=player?Math.atan2(Math.sin(Math.atan2(player.x-position.x,player.z-position.z)-physician.rotation.y),Math.cos(Math.atan2(player.x-position.x,player.z-position.z)-physician.rotation.y)):0;physicianRig.update({dt,time,speed,turn,working:speed<.01&&Math.hypot(position.x-activity.target.x,position.z-activity.target.z)<.12,lookYaw,talking:dialogOpen});if(dt>0||distance>.001||Math.abs(position.y-before.y)>.001)onChange({dynamic:true});}
  },destroy(){disposed=true;collision?.destroy();actorCollision?.destroy();physicianRig?.dispose();scene.remove(group);group.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.skeleton?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const value of Object.values(m))if(value?.isTexture)value.dispose();m.dispose();}}});onChange();}};
}
