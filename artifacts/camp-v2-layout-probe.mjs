import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {terrainHeight,collidesAtHeight,supportHeight} from '../playable/src/layout.mjs';
const candidate=[['command',-17,174],['medical',4,174],['workshop',20,174]];
const manifest=JSON.parse(await fs.readFile(new URL('../playable/assets/camp-v2/manifest.json',import.meta.url)));
for(const [id,x,z] of candidate){
 const file=new URL(`../playable/assets/camp-v2/${id}.glb`,import.meta.url),bytes=await fs.readFile(file),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const box=new THREE.Box3().setFromObject(gltf.scene),size=box.getSize(new THREE.Vector3()),b=manifest.buildings.find(b=>b.id===id);
 const samples=[['base',x,z],['inside',x,z+1],['door',x,z+b.entrance[2]],['platform',x,z+b.platform.center[2]],['stair',x,z+b.stairs.center[2]],['approach',x,z+b.approach[2]]].map(([name,sx,sz])=>({name,x:sx,z:sz,terrain:terrainHeight(sx,sz),blocked:collidesAtHeight(sx,sz,terrainHeight(sx,sz)),support:supportHeight(sx,sz)}));
 console.log(JSON.stringify({id,size:size.toArray(),min:box.min.toArray(),max:box.max.toArray(),samples}));
}
