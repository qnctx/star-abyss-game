import {AnimationMixer,LoopOnce,LoopRepeat,Group} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

const required=['ground-idle','ground-walk','ground-claw','takeoff','flight','dive','sweep','land','hit','death'];
export function createRiftwingAsset({root,terrainHeight,enabled=true,loadAsset,assetUrl}){
 const url=assetUrl??new URL('assets/creatures/riftwing-r11/riftwing-r11.glb',globalThis.document?.baseURI??'http://localhost/playable/').href;
 let state={status:enabled?'loading':'ready',url},pending=null,template=null,disposed=false,token=0,latest=null;
 const actors=new Map();
 function releaseTemplate(){if(!template)return;const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();template.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.skeleton)skeletons.add(o.skeleton);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){materials.add(m);for(const t of Object.values(m))if(t?.isTexture)textures.add(t);}});skeletons.forEach(s=>s.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>{t.source?.data?.close?.();t.dispose();});template=null;}
 function clear(){for(const a of actors.values()){a.mixer.stopAllAction();a.mixer.uncacheRoot(a.model);a.model.traverse(o=>o.skeleton?.dispose());root.remove(a.anchor);}actors.clear();releaseTemplate();}
 function retry(){
   if(disposed)return Promise.resolve(state);if(!enabled)return pending??(pending=Promise.resolve(state));if(pending&&state.status!=='failed')return pending;
   const generation=++token;state={status:'loading',url};
   pending=(async()=>{
     const gltf=loadAsset?await loadAsset(url):await new GLTFLoader().loadAsync(url);
     if(disposed||generation!==token){template=gltf;releaseTemplate();return state;}
     template=gltf;const names=gltf.animations.map(c=>c.name);for(const name of required)if(!names.includes(name))throw Error('Missing riftwing animation '+name);
     let skinned=0;gltf.scene.traverse(o=>{if(o.isSkinnedMesh)skinned++;});if(!skinned)throw Error('Riftwing requires a skinned model');
     state={status:'ready',url,clips:names};if(latest)update(latest);return state;
   })().catch(error=>{clear();return state={status:disposed?'disposed':'failed',url,error:String(error.message||error)};});return pending;
 }
 function update(view){
   latest=view;if(disposed||state.status!=='ready'||!template)return;
   const present=new Set();
   for(const v of view.enemies||[]){if(v.kind!=='riftwing')continue;present.add(v.id);
     let a=actors.get(v.id);if(!a){const anchor=new Group(),model=clone(template.scene);anchor.name='riftwing-'+v.id;anchor.add(model);root.add(anchor);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});const mixer=new AnimationMixer(model);a={anchor,model,mixer,actions:new Map(template.animations.map(c=>[c.name,mixer.clipAction(c)])),clip:null,lastTime:view.time,lastAlive:v.alive!==false,phaseStart:view.time};actors.set(v.id,a);}
     a.anchor.visible=!!view.player&&Math.hypot(v.x-view.player.x,v.z-view.player.z)<420;
     if(!a.anchor.visible){a.lastTime=view.time;continue;}
     const now=Number.isFinite(view.time)?view.time:0,dt=Math.max(0,Math.min(.1,now-(a.lastTime??now)));a.lastTime=now;
     const groundSpeed=dt>0&&a.lastPosition?Math.hypot(v.x-a.lastPosition.x,v.z-a.lastPosition.z)/dt:0;a.lastPosition={x:v.x,z:v.z};
     a.anchor.position.set(v.x,Number.isFinite(v.y)?v.y:terrainHeight(v.x,v.z),v.z);a.anchor.rotation.y=v.yaw||0;
     const dead=v.alive===false||v.phase==='dead',attack=v.attack&&now<v.attack.end;
     let clip=dead?'death':v.phase==='hurt'?'hit':attack?(v.attack.kind==='claw'?'ground-claw':v.attack.kind==='dive'?'dive':'sweep'):v.mode==='takeoff'?'takeoff':v.mode==='landing'?'land':v.mode==='air'?'flight':['chase','patrol','return'].includes(v.phase)?'ground-walk':'ground-idle';
     const action=a.actions.get(clip);
     action.setEffectiveTimeScale(clip==='ground-walk'?Math.max(.5,Math.min(3,groundSpeed/1.16)):1);
     if(clip!==a.clip){const previous=a.actions.get(a.clip);action.reset();action.setLoop(['ground-idle','ground-walk','flight'].includes(clip)?LoopRepeat:LoopOnce,Infinity);action.clampWhenFinished=true;action.play();if(previous)action.crossFadeFrom(previous,.16,false);if(['takeoff','land','death'].includes(clip)&&Number.isFinite(v.modeSince))action.time=Math.max(0,Math.min(action.getClip().duration,now-v.modeSince));else if(dead&&!a.clip)action.time=action.getClip().duration;a.clip=clip;a.phaseStart=now;}
     if(attack&&['ground-claw','dive','sweep'].includes(clip)){const duration=action.getClip().duration,contact=v.attack.contact??(v.attack.start+v.attack.end)/2;const progress=now<=contact?.5*(now-v.attack.start)/Math.max(.01,contact-v.attack.start):.5+.5*(now-contact)/Math.max(.01,v.attack.end-contact);action.time=Math.max(0,Math.min(duration,progress*duration-dt));}
     a.mixer.update(dt);a.lastAlive=!dead;
   }
   for(const [id,a]of actors)if(!present.has(id))a.anchor.visible=false;
 }
 retry();
 return {update,retry,get ready(){return pending??Promise.resolve(state);},get assetStatus(){return state;},snapshot:()=>[...actors].map(([id,a])=>({id,visible:a.anchor.visible,clip:a.clip,position:a.anchor.position.toArray()})),dispose(){if(disposed)return;disposed=true;token++;clear();state={status:'disposed',url};}};
}
