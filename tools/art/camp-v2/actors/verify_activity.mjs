import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createNPCRig } from '../../../../playable/src/progression-quests/npc-rig.mjs';
globalThis.ProgressEvent ??= class ProgressEvent {constructor(type,props){this.type=type;Object.assign(this,props);}};
const results=[];
for(const name of ['N01','N03','N04','N05','SuHe']){
 const path=name==='SuHe'?'playable/assets/foundation/su-he-v1.glb':`playable/assets/progression-quests/${name}-original.glb`;
 const raw=fs.readFileSync(path),jsonLength=raw.readUInt32LE(12),json=JSON.parse(raw.subarray(20,20+jsonLength).toString()),bin=raw.subarray(28+jsonLength);
 // Geometry-only loading for a CPU skin test; source materials/textures remain untouched.
 json.buffers[0].uri=`data:application/octet-stream;base64,${bin.toString('base64')}`;
 delete json.images;delete json.textures;delete json.materials;
 for(const m of json.meshes)for(const p of m.primitives)delete p.material;
 const gltf=await new GLTFLoader().parseAsync(JSON.stringify(json),'');
 const rig=createNPCRig(gltf),mesh=[];rig.root.traverse(o=>{if(o.isSkinnedMesh)mesh.push(o);});
 const base=mesh.map(m=>Array.from({length:m.geometry.attributes.position.count},(_,i)=>m.getVertexPosition(i,new THREE.Vector3())));
 let movedLegVertices=0,maxDisplacement=0,invalidWeights=0;
 for(const m of mesh){const a=m.geometry.attributes.skinWeight;for(let i=0;i<a.count;i++)if(Math.abs(a.getX(i)+a.getY(i)+a.getZ(i)+a.getW(i)-1)>1e-5)invalidWeights++;}
 for(let f=0;f<25;f++)rig.update({dt:1/60,time:f/60,speed:.22});
 mesh.forEach((m,mi)=>{for(let i=0;i<base[mi].length;i++){const v=m.getVertexPosition(i,new THREE.Vector3());assert.ok([v.x,v.y,v.z].every(Number.isFinite));const d=v.distanceTo(base[mi][i]);maxDisplacement=Math.max(maxDisplacement,d);if(base[mi][i].y<.8&&d>.005)movedLegVertices++;}});
 assert.ok(movedLegVertices>100,`${name}: legs must move`);assert.equal(invalidWeights,0);assert.ok(maxDisplacement<.35);
 for(let f=0;f<180;f++)rig.update({dt:1/60,time:1+f/60,speed:0});
 const stopped=Math.max(...rig.bones.slice(6).map(b=>Math.abs(b.rotation.x)));assert.ok(stopped<1e-8);
 rig.update({dt:1,time:5,working:true});assert.ok(rig.bones[4].rotation.x<0);
 assert.equal(rig.root.position.length(),0);assert.equal(rig.root.rotation.y,0);
 results.push({name,vertices:rig.vertices,bones:rig.bones.length,movedLegVertices,maxDisplacement,invalidWeights,stopped});
 rig.dispose();
}
fs.writeFileSync('docs/art/camp-v2/actors/cpu-validation.json',JSON.stringify({passed:true,results},null,2));console.log(JSON.stringify(results,null,2));
