import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCampV2Scene} from '../playable/src/camp-v2/scene.mjs';
import {createMobility,stepMobility} from '../playable/src/mobility.mjs';
import {supportHeight,terrainHeight,collidesAtHeight} from '../playable/src/layout.mjs';
import {physicalPropSupport} from '../playable/src/foundation/physical-props.mjs';
const loader=new GLTFLoader(),scene=new THREE.Scene(),camp=createCampV2Scene({scene,loadAsset:async(_,id)=>{const bytes=await fs.readFile(new URL(`../playable/assets/camp-v2/${id}.glb`,import.meta.url));return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}});await camp.ready;
for(const [id,x,z] of [['N01',-17,181],['N03',20,182.3]])for(const dt of [1/30,1/60,1/90,1/120,1/144,1/240,'mixed','spiky']){
 const player={x,z,y:terrainHeight(x,z),yaw:0,heading:0,vx:0,vz:0,posture:'stand'},mobility=createMobility(),path=[];let maxY=0,blocked=0;
 let elapsed=0,i=0,nextSample=0;
 while(elapsed<13.2){const step=typeof dt==='number'?dt:dt==='mixed'?[.016,.014,.025,.008,.018,.033][i%6]:[.016,.016,.05,.005,.03,.012][i%6];const result=stepMobility(player,mobility,{forward:true,walk:true,tactical:true,posture:'stand',sprint:false,boost:false},step);elapsed+=step;maxY=Math.max(maxY,player.y);if(result.blocked)blocked++;if(elapsed>=nextSample){path.push({t:elapsed,x:player.x,z:player.z,y:player.y,ground:supportHeight(player.x,player.z),prop:physicalPropSupport(player.x,player.z,player.y+.08),blocked:result.blocked,airborne:mobility.jump.airborne,sideBlocked:collidesAtHeight(player.x,player.z,player.y)});nextSample+=.2;}i++;}
 console.log(JSON.stringify({id,dt,final:path.at(-1),maxY,blocked,path:path.filter(p=>p.t<3.8)}));
}
camp.destroy();
