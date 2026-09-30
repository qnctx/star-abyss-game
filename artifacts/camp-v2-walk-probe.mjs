import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCampV2Scene} from '../playable/src/camp-v2/scene.mjs';
import {createMobility,stepMobility} from '../playable/src/mobility.mjs';
import {supportHeight,terrainHeight} from '../playable/src/layout.mjs';
const loader=new GLTFLoader(),scene=new THREE.Scene(),camp=createCampV2Scene({scene,loadAsset:async(_,id)=>{const bytes=await fs.readFile(new URL(`../playable/assets/camp-v2/${id}.glb`,import.meta.url));return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}});await camp.ready;
for(const x of [-17,4,20]){
 const player={x,z:180,y:terrainHeight(x,180),yaw:0,heading:0,vx:0,vz:0,posture:'stand'},mobility=createMobility();let blocked=0,maxY=0;
 for(let i=0;i<240;i++){const result=stepMobility(player,mobility,{forward:1,walk:true},.05);if(result.blocked)blocked++;maxY=Math.max(maxY,player.y);}
 console.log(JSON.stringify({x,approach:{x:player.x,z:player.z,y:player.y,support:supportHeight(player.x,player.z),blocked,maxY,airborne:mobility.jump.airborne}}));
 for(let i=0;i<240;i++)stepMobility(player,mobility,{backward:1,walk:true},.05);
 console.log(JSON.stringify({x,return:{x:player.x,z:player.z,y:player.y,support:supportHeight(player.x,player.z),airborne:mobility.jump.airborne}}));
}
camp.destroy();
