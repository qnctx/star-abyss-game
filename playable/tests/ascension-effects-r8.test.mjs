import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createAscensionEffects} from '../src/ascension-effects.mjs';

test('real six GLBs load; combat VFX uses authoritative aim/time and cancels with the cast',async()=>{
 const scene=new THREE.Scene(),loader=new GLTFLoader(),effects=createAscensionEffects(scene,{loadAsset:async id=>{const data=await readFile(new URL('../assets/ascension-r8/'+id+'.glb',import.meta.url));return loader.parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');}});
 await effects.ready;assert.equal(effects.snapshot().ready,true);assert.equal(effects.snapshot().assets.length,6);assert.deepEqual(effects.snapshot().errors,[]);
 const avatar=new THREE.Group(),base={player:{yaw:0},avatar,time:100,flight:{active:true,boosting:true},cameraMode:'third'};
 effects.update(base);assert.equal(effects.snapshot().boostVisible,true);effects.update({...base,cameraMode:'first'});assert.equal(effects.snapshot().boostVisible,false);
 const cast={id:'test-rift',kind:'void-break',realm:8,origin:{x:0,y:10,z:0},aim:{x:0,y:1,z:-20},direction:{x:0,y:-.410,z:-.912},start:5,release:6.8,end:8.3,resolved:false};
 const combat={aerialCasts:[cast],time:5.5,screen:'playing'};
 effects.update({...base,combat});assert.deepEqual(effects.snapshot().active,['void-fracture']);
 const rift=effects.root.getObjectByName('ascension-void-fracture-0');assert.deepEqual(rift.position.toArray(),[0,1,-20]);const firstScale=rift.scale.x;
 effects.update({...base,time:999,combat});assert.equal(rift.scale.x,firstScale,'render wall time cannot advance a combat charge');
 effects.update({...base,combat:{...combat,screen:'hidden'}});assert.equal(rift.visible,false,'menus hide active combat effects');
 effects.update({...base,combat:{...combat,time:6.8}});assert.ok(rift.scale.x>firstScale);
 effects.update({...base,combat:null});assert.deepEqual(effects.snapshot().active,[],'leaving the combat chart removes old effects');
 const blade={...cast,id:'blade',realm:4,kind:'air-blade',origin:{x:0,y:1,z:0},aim:{x:0,y:1,z:-30},direction:{x:0,y:0,z:-1},start:10,release:10.5,end:11.25};
 effects.update({...base,combat:{aerialCasts:[blade],time:10.25,screen:'playing'}});
 const crescent=effects.root.getObjectByName('ascension-aerial-crescent-0');assert.equal(crescent.position.z,-16.5);
 effects.update({...base,combat:{aerialCasts:[blade],time:10.5,screen:'playing'}});assert.deepEqual(crescent.position.toArray(),[0,1,-30],'blade reaches actual aim exactly at authoritative release');
 effects.update({...base,combat:null});
 effects.update({...base,blink:{serial:1,realm:9,from:{x:0,y:4,z:0},to:{x:0,y:4,z:200},yaw:0,mode:'short'}});assert.deepEqual(effects.snapshot().active,['dao-gate','dao-gate']);
 effects.dispose();assert.equal(scene.children.length,0);
});
