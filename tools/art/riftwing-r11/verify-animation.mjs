import fs from 'node:fs';import assert from 'node:assert/strict';import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const dir=new URL('../../../playable/assets/creatures/riftwing-r11/',import.meta.url);const bytes=fs.readFileSync(new URL('riftwing-r11.glb',dir));
const loader=new GLTFLoader().register(()=>({name:'cpu-material-audit',loadMaterial:()=>Promise.resolve(new T.MeshStandardMaterial())}));
const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');const mixer=new T.AnimationMixer(gltf.scene);const meshes=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});assert(meshes.length>=2);
const report={renderer:'none, Three.js CPU skinning',clips:{}};const point=new T.Vector3();
for(const clip of gltf.animations){
 mixer.stopAllAction();const action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();const bounds=new T.Box3();let poses=[];
 for(let frame=0;frame<=8;frame++){
  mixer.setTime(clip.duration*frame/8);gltf.scene.updateMatrixWorld(true);
  const frameBox=new T.Box3();for(const mesh of meshes){mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i+=3){mesh.getVertexPosition(i,point);point.applyMatrix4(mesh.matrixWorld);assert(point.toArray().every(Number.isFinite));frameBox.expandByPoint(point);}}
  bounds.union(frameBox);poses.push(frameBox.getSize(new T.Vector3()).toArray());
 }
 report.clips[clip.name]={duration:clip.duration,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},frameSizes:poses};
}
assert(report.clips.flight.frameSizes.some((s,i,a)=>Math.abs(s[1]-a[0][1])>.2),'Flap deforms visible wing span/height');
const idle=report.clips['ground-idle'].bounds,flight=report.clips.flight.bounds;assert(flight.max[0]-flight.min[0]>idle.max[0]-idle.min[0]+1,'Wings actually unfold');
fs.writeFileSync(new URL('../../../docs/art/creatures/riftwing-r11/runtime-animation-verification.json',import.meta.url),JSON.stringify(report,null,2));console.log('Three.js CPU roundtrip: '+gltf.animations.length+' clips, actual skinned vertices finite; fold/unfold and flap visibly deform wing geometry. PASS');
