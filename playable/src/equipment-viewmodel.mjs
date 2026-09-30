import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import data,{sha256} from '../assets/equipment/scanner-data.mjs';

export function createEquipmentViewmodel(){
 const root=new THREE.Group();root.name='first-person-equipment';root.visible=false;
 let model=null,left=null,fins=[],disposed=false;
 const state={status:'loading',visible:false,phase:'hidden',triangles:0,draws:0,sha256};
 const ready=new GLTFLoader().parseAsync(Uint8Array.from(atob(data),c=>c.charCodeAt(0)).buffer,'').then(gltf=>{
  model=gltf.scene;if(disposed)return;
  model.traverse(o=>{if(o.isMesh){o.frustumCulled=false;state.triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;state.draws++;}});
  left=model.getObjectByName('LeftHand');fins=[model.getObjectByName('FinL'),model.getObjectByName('FinR')];
  if(!left||fins.some(f=>!f))throw Error('Incomplete scanner articulation');
  root.add(model);state.status='ready';
 }).catch(e=>{state.status='failed';state.error=e.message;console.error('Scanner asset:',e.message);});
 function update(view={},gait={}){
  const show=!!view.visible&&state.status==='ready',v=view.exposure||0;
  root.visible=show;state.visible=show;state.phase=view.phase||'hidden';
  root.position.set(.34+(1-v)*.20,-.29-(1-v)*.78,-.68+(1-v)*.23);
  root.rotation.set(-.08-(1-v)*.8,-.12+(1-v)*.3,.03+(1-v)*.35);
  // Breathing/step motion belongs to the held item, never to the horizon.
  root.position.y+=Math.sin((gait.phase||0)*Math.PI*4)*.004*(gait.weight||0)*v;
  if(left){const t=view.tap||0;left.position.set(-.10*(1-t),-.25*(1-t),.05*(1-t));left.visible=t>.001;}
  fins.forEach((f,i)=>{if(f)f.rotation.z=(i?1:-1)*(1.1-(view.fins||0)*1.5);});
 }
 function snapshot(){return {...state,position:root.position.toArray(),rotation:root.rotation.toArray().slice(0,3),fins:fins.map(f=>f?.rotation.z??0),leftHandVisible:!!left?.visible};}
 function dispose(){disposed=true;const geometries=new Set(),materials=new Set(),textures=new Set();model?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?Array.isArray(o.material)?o.material:[o.material]:[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());root.clear();}
 return {root,ready,update,snapshot,dispose};
}
