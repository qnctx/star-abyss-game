import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCampV2Scene} from '../playable/src/camp-v2/scene.mjs';
import {collidesAtHeight,supportHeight} from '../playable/src/layout.mjs';
import {physicalPropSupport} from '../playable/src/foundation/physical-props.mjs';
const loader=new GLTFLoader(),camp=createCampV2Scene({scene:new THREE.Scene(),loadAsset:async(_,id)=>{const b=await fs.readFile(new URL(`../playable/assets/camp-v2/${id}.glb`,import.meta.url));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}});await camp.ready;
for(const x of [-17,20])for(const z of [179.15,179.11,179.09,179.07,179.04,179,178.95,178.8,178.6]){
 const q={x,z,centerSupport:supportHeight(x,z,0,.6),forwardSupport:physicalPropSupport(x,z-.42,.6),clearFeet:[]};
 for(let y=0;y<=.64;y+=.02)if(!collidesAtHeight(x,z,y))q.clearFeet.push(Number(y.toFixed(2)));
 console.log(JSON.stringify(q));
}
camp.destroy();
