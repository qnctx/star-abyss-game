import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCampV2Scene} from '../playable/src/camp-v2/scene.mjs';
import {CAMP_V2_BUILDINGS,CAMP_V2_PEOPLE} from '../playable/src/camp-v2/layout.mjs';
import {physicalPropBlocked,physicalPropSupport} from '../playable/src/foundation/physical-props.mjs';

const parser=new GLTFLoader();
async function loadAsset(url){
  const bytes=await fs.readFile(new URL(`../playable/${url}`,import.meta.url));
  return await new Promise((resolve,reject)=>parser.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'',resolve,reject));
}
const scene=new THREE.Scene();
const camp=createCampV2Scene({scene,ground:()=>0,loadAsset});
const result=await camp.ready;
assert.equal(result.status,'ready',result.error);
assert.equal(camp.buildings.size,3);
const rows=[];
for(const def of CAMP_V2_BUILDINGS){
  const building=camp.buildings.get(def.id);
  const bounds=new THREE.Box3().setFromObject(building);
  const front=def.z+3;
  rows.push({id:def.id,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},frontSupport:physicalPropSupport(def.x,front,1.5),frontBlocked:physicalPropBlocked(def.x,front,0,.42,1.85)});
}
for(const [id,person] of Object.entries(CAMP_V2_PEOPLE)){
  rows.push({id,home:person.home,homeSupport:physicalPropSupport(person.home.x,person.home.z,1.5),homeBlocked:physicalPropBlocked(person.home.x,person.home.z,0,.42,1.85)});
}
camp.destroy();
console.log(JSON.stringify(rows,null,2));
