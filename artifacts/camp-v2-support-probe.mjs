import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCampV2Scene} from '../playable/src/camp-v2/scene.mjs';
import {terrainHeight,supportHeight,collidesAtHeight} from '../playable/src/layout.mjs';
const loader=new GLTFLoader(),scene=new THREE.Scene();
const camp=createCampV2Scene({scene,loadAsset:async(_,id)=>{const bytes=await fs.readFile(new URL(`../playable/assets/camp-v2/${id}.glb`,import.meta.url));return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}});
console.log(await camp.ready);
for(const x of [-17,4,20]){const result=[];for(let z=180.2;z>=174.8;z-=.2){const ground=terrainHeight(x,z),support=supportHeight(x,z,0,ground+1.15);result.push({z:Number(z.toFixed(2)),support:Number(support.toFixed(3)),groundBlocked:collidesAtHeight(x,z,ground),supportedBlocked:collidesAtHeight(x,z,support)});}console.log(JSON.stringify({x,result}));}
console.log(JSON.stringify({n06:collidesAtHeight(-3,178,0),spawn:collidesAtHeight(0,190,0),frontLOS:camp.hasLineOfSight({x:-17,y:1,z:180},{x:-17,y:1.75,z:175.7}),wallLOS:camp.hasLineOfSight({x:-20,y:1,z:180},{x:-20,y:1.75,z:175.7})}));
for(const z of [179.4,179.2,179,178.8,178.6,178.4,178.2,178,177.8,177,176.6])console.log(JSON.stringify({z,blocked:[0,.24,.32,.48,.64,.8,1].map(y=>[y,collidesAtHeight(-17,z,y)])}));
camp.destroy();
