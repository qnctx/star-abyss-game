import fs from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const {createCreatureRig}=await import(process.argv[3]==='baseline'?'file:///E:/myProject/star-abyss-game/playable/src/expedition-world/creature-rig.mjs':'../playable/src/expedition-world/creature-rig.mjs');
import {terrainHeight} from '../playable/src/layout.mjs';
// GLB uses authored vertex colours; parse the real delivered geometry/skeleton.
const bytes=fs.readFileSync('playable/assets/creatures/rift-prowler-v1/rift-prowler.glb');
const loader=new GLTFLoader().register(()=>({name:'benchmark-material',loadMaterial:()=>Promise.resolve(new T.MeshStandardMaterial())}));
const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const rig=JSON.parse(fs.readFileSync('playable/assets/creatures/rift-prowler-v1/rig-map.json'));
const anchor=new T.Group();anchor.position.set(20,terrainHeight(20,190),190);
const actor=createCreatureRig(gltf.scene,rig,anchor,terrainHeight),out={};
for(const phase of ['idle','chase','dead']){const times=[];for(let i=0;i<90;i++){actor.update({id:'benchmark',x:20,z:190,yaw:0,phase,hp:phase==='dead'?0:10},i/60+ (phase==='dead'?4:phase==='chase'?2:0));times.push(actor.stats.poseMs);}times.sort((a,b)=>a-b);out[phase]={p50:times[45],p95:times[85],max:times.at(-1),soleVertices:rig.legs.LF.soleVertexIndices.length};}
out.collisionVertices=actor.stats.collisionVertices??43002;actor.dispose();fs.writeFileSync(`reports/performance-r1/${process.argv[2]}-creature.json`,JSON.stringify(out,null,2));console.log(out);
