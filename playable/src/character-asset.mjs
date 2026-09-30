import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {HUMANOID_RIG} from './humanoid-rig.mjs';
import {createCharacterRetarget} from './character-retarget.mjs';
import {createProneHand} from './prone-hands.mjs';

/** Attach an authored skin to the existing motion/foot-contact rig. */
export function attachCharacterAsset({root,skeleton,materials,url,data}) {
  let disposed=false;
  const attached=[];
  let retarget=null;
  const hideHead={value:0};
  const hideHands={value:0},openHands=[];
  root.userData.characterAsset={status:'loading',url};
  const loader=new GLTFLoader();
  const loading=data?loader.parseAsync(Uint8Array.from(atob(data),c=>c.charCodeAt(0)).buffer,''):loader.loadAsync(url);
  const ready=loading.then(gltf=>{
    const imported=gltf.scene;
    imported.updateMatrixWorld(true);
    let nativeRig=null;
    imported.traverse(o=>{if(o.userData.c2NativeRig)nativeRig=JSON.parse(o.userData.c2NativeRig);});
    if(nativeRig)retarget=createCharacterRetarget(root,skeleton,nativeRig.positions);
    const staged=[];
    let triangles=0;
    imported.traverse(source=>{
      if(!source.isSkinnedMesh)return;
      const geometry=source.geometry.clone();
      geometry.applyMatrix4(source.matrixWorld);
      const indices=geometry.getAttribute('skinIndex');
      const weights=geometry.getAttribute('skinWeight');
      if(!indices||!weights||!geometry.getAttribute('uv')&&source.material.map)throw new Error('Character skin or UV data missing');
      const mapping=source.skeleton.bones.map(bone=>HUMANOID_RIG.findIndex(([name])=>name===bone.name));
      for(let i=0;i<indices.count;i++){
        let sum=0;
        for(let j=0;j<4;j++){
          const weight=weights.array[i*4+j],index=mapping[indices.array[i*4+j]];
          if(!Number.isFinite(weight)||weight<0||weight>0&&index<0)throw new Error('Character has incompatible skin weights');
          indices.array[i*4+j]=index>=0?index:0;sum+=weight;
        }
        if(Math.abs(sum-1)>.002)throw new Error('Character skin weights are not normalized');
      }
      indices.needsUpdate=true;
      const mask=new Float32Array(indices.count),handMask=new Float32Array(indices.count);
      for(let i=0;i<indices.count;i++)for(let j=0;j<4;j++){if(indices.array[i*4+j]===4)mask[i]+=weights.array[i*4+j];if([8,12].includes(indices.array[i*4+j]))handMask[i]+=weights.array[i*4+j];}
      geometry.setAttribute('firstPersonHead',new THREE.BufferAttribute(mask,1));
      geometry.setAttribute('proneHandMask',new THREE.BufferAttribute(handMask,1));
      for(const material of Array.isArray(source.material)?source.material:[source.material]){
        material.onBeforeCompile=shader=>{shader.uniforms.hideFirstPersonHead=hideHead;shader.uniforms.hideProneHands=hideHands;shader.vertexShader='attribute float firstPersonHead; attribute float proneHandMask; varying float vFirstPersonHead; varying float vProneHand;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFirstPersonHead=firstPersonHead;vProneHand=proneHandMask;');shader.fragmentShader='uniform float hideFirstPersonHead; uniform float hideProneHands; varying float vFirstPersonHead; varying float vProneHand;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(hideFirstPersonHead>.5 && vFirstPersonHead>.08)discard;\nif(hideProneHands>.5 && vProneHand>.32)discard;');};
        material.customProgramCacheKey=()=> 'c2-first-person-head-mask-v2';
      }
      const mesh=new THREE.SkinnedMesh(geometry,source.material);
      mesh.name=`c2-authored-${source.name}`;mesh.receiveShadow=true;mesh.frustumCulled=false;
      // The geometry is baked into the canonical bind space. Preserve the motion
      // rig's original inverses, even if the download finishes during a walk.
      mesh.bind(retarget?.skeleton??skeleton,new THREE.Matrix4());
      triangles+=(geometry.index?.count??geometry.attributes.position.count)/3;
      staged.push(mesh);
    });
    if(!staged.length||triangles>(nativeRig?70000:45000))throw new Error('Character asset missing or exceeds triangle budget');
    if(disposed){staged.forEach(m=>m.geometry.dispose());return {status:'disposed'};}
    for(const mesh of staged){
      root.add(mesh);attached.push(mesh);
      for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
        if(!materials.includes(material))materials.push(material);
      }
    }
    for(const mesh of [...root.children]){
      if(mesh.name==='explorer-full-body-skin'){root.remove(mesh);mesh.geometry.dispose();}
    }
    root.userData.characterAsset={status:'ready',url,triangles,meshes:staged.length,version:nativeRig?.version??'C2-LUX3D-20260911',retarget:retarget?.report??null};
    if(retarget)for(const [index,side]of [[8,-1],[12,1]]){const hand=createProneHand(side,materials);hand.visible=false;retarget.skeleton.bones[index].add(hand);openHands.push(hand);}
    retarget?.update();
    return root.userData.characterAsset;
  }).catch(error=>{
    retarget?.dispose();retarget=null;
    const result={status:'failed',url,error:error.message};root.userData.characterAsset=result;
    console.error('C2 character asset:',error.message);return result;
  });
  return {ready,eyePosition:()=>retarget?.eyePosition(),update(options){hideHead.value=options.firstPerson?1:0;if(root.userData.characterAsset)root.userData.characterAsset.firstPersonHeadHidden=!!options.firstPerson;hideHands.value=(options.proneBlend||0)>.8?1:0;openHands.forEach(h=>h.visible=hideHands.value>0);retarget?.update(options);},dispose(){disposed=true;openHands.forEach(h=>h.traverse(o=>o.geometry?.dispose()));retarget?.dispose();attached.forEach(mesh=>{root.remove(mesh);mesh.geometry.dispose();});}};
}
