import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Group } from 'three';
import { createCreatureRig } from './creature-rig.mjs';
import { validateCreatureBytes,validateCreatureTemplate } from './creature-validation.mjs';
import rig from '../../assets/creatures/rift-prowler-v1/rig-map.json' with {type:'json'};

export function createCreatureAsset({anchors,terrainHeight,assetUrl,loadAsset,onAssetState}){
  const url=assetUrl??new URL('assets/creatures/rift-prowler-v1/rift-prowler.glb',globalThis.document?.baseURI??'http://localhost/playable/').href;
  let state=Object.freeze({status:'loading',url}),pending,disposed=false,token=0,template=null;
  const actors=new Map();let latest=[];let latestPlayer=null,latestTime=undefined;
  const notify=status=>{state=Object.freeze(status);try{onAssetState?.(state);}catch(error){console.error('Creature status observer',error);}return state;};
  function release(scene){if(!scene)return;const geometries=new Set(),materials=new Set(),textures=new Set(),images=new Set(),skeletons=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.skeleton)skeletons.add(o.skeleton);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});skeletons.forEach(s=>s.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>{if(t.source?.data)images.add(t.source.data);t.dispose();});images.forEach(i=>i.close?.());}
  function clear(){actors.forEach(a=>a.dispose());actors.clear();release(template);template=null;}
  function apply(actorMap=actors,anchorMap=anchors){
    const views=new Map(latest.map(v=>[v.id,v]));
    for(const [id,a]of actorMap){const v=views.get(id),anchor=anchorMap.get(id);anchor.visible=!!v&&!!latestPlayer&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Math.hypot(v.x-latestPlayer.x,v.z-latestPlayer.z)<360;
      if(!anchor.visible){a.reset();continue;}
      anchor.position.set(v.x,terrainHeight(v.x,v.z),v.z);anchor.rotation.y=Number.isFinite(v.yaw)?v.yaw:0;a.update(v,Number.isFinite(latestTime)?latestTime:0,Number.isFinite(latestTime));
    }
  }
  function retry(){
    if(disposed)return Promise.resolve(state);if(pending&&state.status!=='failed')return pending;
    const generation=++token;notify({status:'loading',url});
    pending=Promise.resolve().then(async()=>{
      if(loadAsset)return loadAsset(url);
      const response=await fetch(url);if(!response.ok)throw Error('Creature HTTP '+response.status);
      const bytes=await response.arrayBuffer();await validateCreatureBytes(bytes);
      return new GLTFLoader().parseAsync(bytes,new URL('.',url).href);
    }).then(gltf=>{
      if(disposed||generation!==token){release(gltf.scene);return state;}
      template=gltf.scene;validateCreatureTemplate(gltf,rig);
      const stagedActors=new Map(),stagedAnchors=new Map();
      try {
        for(const [id,anchor]of anchors){const staging=new Group();staging.name=anchor.name;staging.position.copy(anchor.position);staging.quaternion.copy(anchor.quaternion);staging.scale.copy(anchor.scale);stagedAnchors.set(id,staging);stagedActors.set(id,createCreatureRig(template,rig,staging,terrainHeight));}
        apply(stagedActors,stagedAnchors);
        for(const [id,staging]of stagedAnchors){const anchor=anchors.get(id);anchor.position.copy(staging.position);anchor.quaternion.copy(staging.quaternion);anchor.visible=staging.visible;stagedActors.get(id).mount(anchor);}
        stagedActors.forEach((a,id)=>actors.set(id,a));
      } catch(error){stagedActors.forEach(a=>a.dispose());throw error;}
      return notify({status:'ready',url,vertices:43002,triangles:35967,bones:20,instances:actors.size});
    }).catch(error=>{clear();for(const a of anchors.values())a.visible=false;return disposed?state:notify({status:'failed',url,error:String(error.message??error)});});
    return pending;
  }
  retry();
  return {get ready(){return pending;},get assetStatus(){return state;},retry,get actors(){return actors;},
    update(view){latestPlayer=view.player?{x:view.player.x,z:view.player.z}:null;latestTime=view.time;latest=(view.enemies??[]).map(({id,instanceId,x,z,yaw,hp,alive,phase})=>({id,instanceId,x,z,yaw,hp,alive,phase}));if(state.status==='ready')apply();},
    dispose(){if(disposed)return;disposed=true;token++;clear();notify({status:'disposed',url});}};
}
