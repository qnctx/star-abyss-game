import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCampV2Scene} from '../playable/src/camp-v2/scene.mjs';
import {createMobility,stepMobility} from '../playable/src/mobility.mjs';
import {terrainHeight,collides} from '../playable/src/layout.mjs';
const loader=new GLTFLoader(),camp=createCampV2Scene({scene:new THREE.Scene(),loadAsset:async(_,id)=>{const bytes=await fs.readFile(new URL('../playable/assets/camp-v2/'+id+'.glb',import.meta.url));return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}});await camp.ready;
for(const [id,target] of Object.entries({N02:{x:4.5,z:176.2,y:.8},N04:{x:25.5,z:181.5,y:0}})){
 const rows=[];
 for(let angle=0;angle<Math.PI*2;angle+=Math.PI/8){const x=target.x+Math.sin(angle)*5,z=target.z+Math.cos(angle)*5,heading=Math.atan2(x-target.x,z-target.z);if(collides(x,z))continue;
  const player={x,z,y:terrainHeight(x,z),yaw:heading,heading,vx:0,vz:0,posture:'stand'},mobility=createMobility();let closest=Infinity,success=null;
  for(let i=0;i<240;i++){stepMobility(player,mobility,{forward:true,walk:true},.05);const d=Math.hypot(player.x-target.x,player.z-target.z);closest=Math.min(closest,d);if(d<3.15&&camp.hasLineOfSight({x:player.x,y:player.y+1,z:player.z},{x:target.x,y:target.y+1,z:target.z})){success={t:i*.05,x:player.x,y:player.y,z:player.z,d};break;}}
  rows.push({angle:Number(angle.toFixed(3)),start:{x:Number(x.toFixed(2)),z:Number(z.toFixed(2))},closest:Number(closest.toFixed(3)),end:{x:Number(player.x.toFixed(2)),y:Number(player.y.toFixed(2)),z:Number(player.z.toFixed(2))},success});
 }
 console.log(id,JSON.stringify(rows));
}
camp.destroy();
