import { createCreatureAsset } from './creature-asset.mjs';
import {createRiftwingAsset} from './riftwing-asset.mjs';
import { definitions } from './definitions.mjs';
export { definitions } from './definitions.mjs';
export { createWorldQueries } from './queries.mjs';

// Rendering only. Inject the same Three namespace as the original renderer.
export function createExpeditionWorld({ THREE:T, scene, terrainHeight, assetUrl, loadAsset, onAssetState }) {
  if(!T?.Group || !scene?.add || typeof terrainHeight!=='function')throw new TypeError('THREE, scene and terrainHeight required');
  const root=new T.Group(); root.name='expedition-world'; scene.add(root);
  const geometries=new Set(), materials=new Set(), resources=new Map(), enemies=new Map(), drops=new Map();
  let disposed=false;
  const mat=(color,extra={})=>{const m=new T.MeshStandardMaterial({color,roughness:.92,metalness:.2,...extra});materials.add(m);return m;};
  const stone=mat('#4d4550'),ore=mat('#756c73',{metalness:.65}),moss=mat('#597b78');
  const glow=mat('#b77d4b',{emissive:'#bd692b',emissiveIntensity:.7}),dew=mat('#82bbc1',{emissive:'#346a70',emissiveIntensity:.45});
  const geo=g=>{geometries.add(g);return g;};
  const sphere=geo(new T.SphereGeometry(1,10,6)), shard=geo(new T.DodecahedronGeometry(1,0));
  function mesh(parent,g,m,x,y,z,sx=1,sy=1,sz=1){const a=new T.Mesh(g,m);a.position.set(x,y,z);a.scale.set(sx,sy,sz);a.receiveShadow=true;parent.add(a);return a;}
  function group(name,x,z){const g=new T.Group();g.name=name;g.position.set(x,terrainHeight(x,z),z);root.add(g);return g;}
  // Ankle-low mineral outcrops conform per-piece to the original terrain.
  for(const d of definitions.resources){
    const g=group(d.id,d.x,d.z),live=new T.Group();g.add(live);
    for(let i=0;i<7;i++){
      const angle=i*2.39996, r=.12+i*.09,dx=Math.cos(angle)*r,dz=Math.sin(angle)*r;
      const y=terrainHeight(d.x+dx,d.z+dz)-g.position.y;
      mesh(g,shard,stone,dx,y+.04,dz,.32,.055,.27);
      const p=mesh(live,shard,d.kind==='herb'?moss:ore,dx,y+.085,dz,.19,.09,.14);p.rotation.y=angle;
      mesh(live,sphere,d.kind==='herb'?dew:glow,dx,y+.15,dz,.045,.025,.045);
    }
    g.visible=false;resources.set(d.id,{g,live});
  }
  const anchors=new Map(definitions.enemies.map(d=>{const g=group(d.id,d.x,d.z);g.visible=false;return [d.id,g];}));
  const creature=createCreatureAsset({anchors,terrainHeight,assetUrl,loadAsset,onAssetState});
  const riftwing=createRiftwingAsset({root,terrainHeight,enabled:!loadAsset});
  const assetState=()=>{const wing=riftwing.assetStatus,old=creature.assetStatus;return old.status!=='ready'?old:wing.status!=='ready'?wing:old;};
  let combinedReady=null,creatureReady=null,wingReady=null;
  function ready(){const a=creature.ready,b=riftwing.ready;if(!combinedReady||a!==creatureReady||b!==wingReady){creatureReady=a;wingReady=b;combinedReady=Promise.all([a,b]).then(assetState);}return combinedReady;}
  function update(view={}){
    if(disposed)return;
    const p=view.player;if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.z)){root.visible=false;return;}root.visible=true;
    const nearby=(x,z,r)=>Math.hypot(x-p.x,z-p.z)<r;
    const resourceViews=new Map((view.resources||[]).map(v=>[v.id,v]));
    for(const [id,e] of resources){const v=resourceViews.get(id);e.g.visible=!!v&&nearby(e.g.position.x,e.g.position.z,240);e.live.visible=!!v&&v.remaining>0;}
    creature.update(view);
    riftwing.update(view);
    const present=new Set();
    for(const v of view.drops||[]){
      if(!Number.isFinite(v.x)||!Number.isFinite(v.z)||!(v.remaining>0))continue;
      present.add(v.id);let g=drops.get(v.id);if(!g){g=group('drop-'+v.id,v.x,v.z);mesh(g,shard,ore,0,.12,0,.22,.14,.26);mesh(g,sphere,dew,0,.24,0,.055,.04,.055);drops.set(v.id,g);}
      g.position.set(v.x,terrainHeight(v.x,v.z),v.z);g.visible=nearby(v.x,v.z,180);
    }
    for(const [id,g]of drops)if(!present.has(id)){root.remove(g);drops.delete(id);}
  }
  function dispose(){if(disposed)return;disposed=true;creature.dispose();riftwing.dispose();scene.remove(root);root.clear();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());resources.clear();enemies.clear();drops.clear();}
  return {root,update,dispose,get ready(){return ready();},get assetStatus(){return assetState();},retry(){creature.retry();riftwing.retry();return ready();},get creatureActors(){return creature.actors;},riftwingSnapshot:riftwing.snapshot};
}
