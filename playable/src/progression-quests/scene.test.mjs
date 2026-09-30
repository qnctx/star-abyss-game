import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createProgressionScene} from './scene.mjs';import {createNPCRig} from './npc-rig.mjs';import {TRIAL_NODES,NPCS} from './data.mjs';
import {collidesAtHeight,PROP_SOLIDS,terrainHeight} from '../layout.mjs';
import {createWorldQueries} from '../expedition-world/queries.mjs';
import {createProgressionRuntime} from './runtime.mjs';
import {physicalPropBlocked,physicalPropSupport} from '../foundation/physical-props.mjs';
function originalScene(){const scene=new THREE.Scene();for(let i=1;i<=3;i++){const group=new THREE.Group();group.name='relay-'+i;group.add(new THREE.Mesh(new THREE.BoxGeometry(1.25,1.6,.8),new THREE.MeshStandardMaterial()));scene.add(group);}return scene;}
// Geometry here is deliberately a test fixture; production only uses verified GLB and original devices.
const fixtureGLTF=()=>{const scene=new THREE.Group();const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.32,.28,1.8,16,12),new THREE.MeshStandardMaterial());mesh.position.y=.9;scene.add(mesh);return {scene};};
test('missing NPC manifests cause zero fetch and no NPC interaction/collision; existing relay clones are ready',async()=>{
  const scene=originalScene(),solids=[];let calls=0;const view=createProgressionScene({scene,assets:{},solidRegistry:solids,loadAsset:async()=>{calls++;return fixtureGLTF();}});await view.ready;
  assert.equal(calls,0);for(const npc of NPCS)assert.equal(view.npcReady(npc.id),false);for(const node of TRIAL_NODES){assert.equal(view.nodeReady(node.id),true);assert(scene.getObjectByName(node.id));}assert.equal(solids.length,0);assert.equal(view.snapshot().meshColliderCount,3);view.dispose();assert(scene.getObjectByName('relay-1'));
});
test('delivered model heads/chest animate but root does not swivel; load failure remains fail closed',async()=>{
 const scene=originalScene(),assets=Object.fromEntries(NPCS.map(n=>[n.id,{status:'ready',url:n.id+'.glb',height:1.8,yaw:.3}])),solids=[];const view=createProgressionScene({scene,assets,solidRegistry:solids,loadAsset:async(url,id)=>{if(id==='N04')throw Error('network');return fixtureGLTF();}});await view.ready;
 assert.equal(view.npcReady('N01'),true);assert.equal(view.npcReady('N04'),false);view.update({dt:.1,player:{x:-7,z:188},talkingNpc:'N01'});const a=view.snapshot().npcs.N01;
  assert.equal(a.rootRotation[1],.3);assert(a.bones.some(b=>b.name==='quest-head'&&Math.abs(b.rotation[1])>0));assert(a.bones.some(b=>b.name==='quest-chest'&&Math.abs(b.rotation[0])>0));assert.equal(solids.length,0);assert.equal(view.snapshot().meshColliderCount,6);view.dispose();
});
test('skeletal weights finite and normalized, no root movement',()=>{const rig=createNPCRig(fixtureGLTF());rig.root.traverse(m=>{if(!m.isSkinnedMesh)return;const w=m.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++)assert(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-6);});const before=rig.root.matrix.clone();rig.update({time:2,lookYaw:2,talking:true});rig.root.updateMatrix();assert.deepEqual(rig.root.matrix.elements,before.elements);rig.dispose();});
test('real shared world collision blocks nodes, front-side LOS can still authorize tuning',async()=>{
  const before=PROP_SOLIDS.length,view=createProgressionScene({scene:originalScene(),assets:{}});await view.ready;const node=TRIAL_NODES[0],queries=createWorldQueries();
  assert.equal(physicalPropBlocked(node.x,node.z+.5,terrainHeight(node.x,node.z),.42,1.85),true);const p={x:node.x,z:node.z+2.5,yaw:0};assert.equal(queries.canOccupy(p),true);
 const ctx={playing:true,menu:false,player:p,progressionReady:{npcs:[],nodes:TRIAL_NODES.map(n=>n.id)}},root={combat:{actors:[{id:'p',hp:'100'}]}};
 const runtime=createProgressionRuntime({getRoot:()=>root,getContext:()=>ctx,playerId:'p',issue:()=>true,lineOfSight:queries.hasLineOfSight});assert.equal(runtime.authorize(root,{progression:{action:'trial-start',node:node.id,tuning:node.tuning}}),true);
 view.dispose();assert.equal(PROP_SOLIDS.length,before);
});
test('all camp placements have supported, unobstructed original ground and a reachable front approach',()=>{const queries=createWorldQueries();for(const def of [...NPCS,...TRIAL_NODES]){assert(Number.isFinite(terrainHeight(def.x,def.z)));assert.equal(queries.canOccupy(def,.8),true,def.id+' placement');assert.equal(queries.canOccupy({x:def.x,z:def.z+2.6},.42),true,def.id+' approach');}});
test('moving NPC capsule has no fake foot platform and visibility disables collision with one invalidation',async()=>{
 const scene=originalScene();let changes=0;const assets={N01:{status:'ready',url:'fixture.glb',height:1.8,yaw:0}};
 const view=createProgressionScene({scene,terrainHeight:()=>0,assets,loadAsset:async()=>fixtureGLTF(),onChange:()=>changes++});await view.ready;
 const {x,z}=NPCS[0];assert.equal(physicalPropSupport(x,z,10),-Infinity);assert(physicalPropBlocked(x,z,0,.42,1.85));assert.equal(physicalPropBlocked(x+.9,z,0,.42,1.85),false);
 const before=changes;view.update({visible:false});assert.equal(changes,before+1);assert.equal(physicalPropBlocked(x,z,0,.42,1.85),false);
 view.update({visible:false});assert.equal(changes,before+1);view.update({visible:true});assert.equal(changes,before+2);assert(physicalPropBlocked(x,z,0,.42,1.85));view.dispose();assert.equal(physicalPropBlocked(x,z,0,.42,1.85),false);
});
test('skeletal animation requests a dynamic shadow refresh; visibility changes remain immediate',async()=>{
 const changes=[];const view=createProgressionScene({scene:originalScene(),terrainHeight:()=>0,assets:{N01:{status:'ready',url:'fixture.glb',height:1.8,yaw:0}},loadAsset:async()=>fixtureGLTF(),onChange:event=>changes.push(event)});await view.ready;
 changes.length=0;view.update({dt:1/60,player:{x:0,z:0},visible:true});
 assert.deepEqual(changes,[{dynamic:true}]);
 changes.length=0;view.update({dt:0,player:{x:0,z:0},visible:false});
 assert.deepEqual(changes,[undefined]);view.dispose();
});
