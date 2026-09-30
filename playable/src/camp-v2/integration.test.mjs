import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCampV2Scene} from './scene.mjs';
import {createCampActivity} from './activity.mjs';
import {CAMP_V2_PEOPLE} from './layout.mjs';
import {createMobility,stepMobility} from '../mobility.mjs';
import {supportHeight,terrainHeight} from '../layout.mjs';
import {createExpeditionRuntime} from '../expedition-runtime/index.mjs';
import {definitions} from '../expedition-world/definitions.mjs';
import {createCampScene} from '../foundation/camp-scene.mjs';
import {registerPhysicalProps} from '../foundation/physical-props.mjs';

test('authored stairs support real walking to each NPC entrance and a return to ground',async()=>{
 const loader=new GLTFLoader(),scene=new THREE.Scene(),camp=createCampV2Scene({scene,loadAsset:async(_,id)=>{
  const bytes=await fs.readFile(new URL(`../../assets/camp-v2/${id}.glb`,import.meta.url));
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 }});
 try{
  assert.equal((await camp.ready).status,'ready');assert.deepEqual(Object.values(camp.buildingStatus).map(s=>s.status),['ready','ready','ready']);
  for(const [id,x] of [['N01',-17],['N02',4],['N03',20]]){
   const player={x,z:180,y:terrainHeight(x,180),yaw:0,heading:0,vx:0,vz:0,posture:'stand'},mobility=createMobility(),target=CAMP_V2_PEOPLE[id].home;
   let reached=false;
   for(let i=0;i<240;i++){
    stepMobility(player,mobility,{forward:1,walk:true},.05);
    if(Math.hypot(player.x-target.x,player.z-target.z)<1.1&&player.y>.65)reached=true;
   }
   assert.ok(reached,`${id} entrance platform was not reachable`);
   assert.ok(!mobility.jump.airborne,`${id} stair ascent unexpectedly became a jump`);
   for(let i=0;i<240;i++)stepMobility(player,mobility,{backward:1,walk:true},.05);
   assert.ok(player.z>178.3&&player.y<.5,`${id} failed to descend front steps`);
  }
  assert.equal(camp.hasLineOfSight({x:4,z:181,y:1},{x:4,z:176,y:1.5}),true);
  assert.equal(camp.hasLineOfSight({x:-23,z:174,y:1},{x:-17,z:174,y:1.5}),false);
 }finally{camp.destroy();}
});

test('a transient contact frame does not erase a raised stair step or allow climbing a side wall',async()=>{
 const loader=new GLTFLoader(),camp=createCampV2Scene({scene:new THREE.Scene(),loadAsset:async(_,id)=>{
  const bytes=await fs.readFile(new URL(`../../assets/camp-v2/${id}.glb`,import.meta.url));
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 }});await camp.ready;
 let armed=true;const remove=registerPhysicalProps({support:()=>-Infinity,blocked:(x,z)=>armed&&Math.abs(x+17)<.5&&z<179.12&&z>178.9});
 try{
  for(const dt of [1/60,1/120]){
   const player={x:-17,z:179.13,y:.24,yaw:0,heading:0,vx:0,vz:-1.65,posture:'stand'},mobility=createMobility();
   armed=true;const contact=stepMobility(player,mobility,{forward:true,walk:true,tactical:true},dt);
   assert.equal(contact.blocked,true);assert.ok(player.y>=.2,'held forward on a visible riser must not drop the foot to terrain');
   armed=false;for(let i=0;i<Math.ceil(3/dt);i++)stepMobility(player,mobility,{forward:true,walk:true,tactical:true},dt);
   assert.ok(player.y>.7&&player.z<177.8,`stair approach failed after a blocked frame at ${dt}s`);
  }
  const wall={x:-23,z:174,y:0,yaw:-Math.PI/2,heading:-Math.PI/2,vx:0,vz:0,posture:'stand'},mobility=createMobility();
  for(let i=0;i<300;i++)stepMobility(wall,mobility,{forward:true,walk:true,tactical:true},1/60);
  assert.ok(wall.x<-21.3&&wall.y<.3,'side wall must remain solid and non-climbable');
 }finally{remove();camp.destroy();}
});

test('N02 menus and nearby player freeze the rendered activity point',()=>{
 const activity=createCampActivity('N02',{holdRadius:4.25});
 const ground=()=>.7572,initial={...activity.position};
 for(let i=0;i<125;i++)activity.update(.1,{ground});
 assert.ok(Math.hypot(activity.position.x-initial.x,activity.position.z-initial.z)>.05);
 const moving={...activity.position};
 for(let i=0;i<20;i++)activity.update(.1,{paused:true,ground});
 assert.deepEqual(activity.position,moving,'dialog must lock N02 at the same visible/authorized position');
 for(let i=0;i<20;i++)activity.update(.1,{player:{x:moving.x+2,z:moving.z},ground});
 assert.deepEqual(activity.position,moving,'near player must stop N02 before F interaction');
});

test('delivered physician GLB uses the same legged rig and keeps a stable position during dialogue',async()=>{
 const original=GLTFLoader.prototype.loadAsync,originalSelf=globalThis.self;globalThis.self=globalThis;
 GLTFLoader.prototype.loadAsync=async function(url){
  const file=url.split('/').at(-1),bytes=await fs.readFile(new URL(`../../assets/foundation/${file}`,import.meta.url));
  return this.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 };
 const scene=new THREE.Scene(),doctor=createCampScene({scene});
 try{
  const result=await doctor.ready;assert.equal(result.status,'ready',result.error);
  const rig=doctor.collisionMeshes[0],skins=[];rig.traverse(o=>{if(o.isSkinnedMesh)skins.push(o);});
  assert.ok(skins.length>0);assert.equal(skins[0].skeleton.bones.length,12);
  for(let i=0;i<140;i++)doctor.update({time:i*.1,dt:.1,visible:true});
  const moving={...doctor.position};
  for(let i=0;i<15;i++)doctor.update({time:14+i*.1,dt:.1,visible:true,dialogOpen:true});
  assert.deepEqual(doctor.position,moving);
  assert.doesNotThrow(()=>JSON.stringify({position:doctor.position,status:doctor.assetStatus}));
 }finally{doctor.destroy();GLTFLoader.prototype.loadAsync=original;globalThis.self=originalSelf;}
});

test('N02 near view and CAS authorization follow the live position while the menu is open',async()=>{
 let saved,serial=0;
 const context={playing:true,menu:true,mounted:false,player:{x:4,z:179.9,y:0,yaw:0,pitch:0},physicianPosition:{x:4.7,z:175.65,y:.7572,radius:3.2}};
 const storage={load:async()=>structuredClone(saved),initialize:async value=>{saved=structuredClone(value);},close(){},compareAndSwap:async({expectedRevision,nextState})=>{if(saved.revision!==expectedRevision)return false;saved=structuredClone(nextState);return true;}};
 const runtime=await createExpeditionRuntime({link:{worldId:'camp-live-position',playerId:'player'},world:{...definitions,resources:[],sites:[definitions.sites[0]],enemies:[definitions.enemies[0]]},queries:{terrainHeight:()=>0,canOccupy:()=>true,canTraverse:()=>true,hasLineOfSight:()=>true,dynamicBlocked:()=>false},getContext:()=>context,openStorage:async()=>storage,makeId:()=>`camp-${++serial}`,isVisible:()=>false});
 try{
  assert.equal(runtime.campView().near,false,'old physician home must not authorize the moved NPC');
  assert.equal(await runtime.action({type:'camp',camp:{action:'teach'}}),false);
  const distantError=runtime.campView().error;
  Object.assign(context.player,{x:4.7,z:173.2});
  assert.equal(runtime.campView().near,true,'current physician point must authorize proximity');
  assert.equal(await runtime.action({type:'camp',camp:{action:'teach'}}),false,'no real blood sample means teaching still fails');
  assert.notEqual(runtime.campView().error,distantError,'near request must reach the material validation after CAS authorization');
  assert.equal(runtime.snapshot().revision,0);
 }finally{runtime.destroy();}
});
