import test from 'node:test';import assert from 'node:assert/strict';
import {Group,Bone,Skeleton,SkinnedMesh,BoxGeometry,MeshBasicMaterial,AnimationClip} from 'three';
import {createGroundCombatRecoil} from '../src/ground-combat-recoil.mjs';
import {createWorldQueries} from '../src/expedition-world/queries.mjs';
import {createRiftwingAsset} from '../src/expedition-world/riftwing-asset.mjs';
import {terrainHeight,WALLS} from '../src/layout.mjs';
test('riftwing volume sweeps reject buildings, underground, ceilings and invalid segments',()=>{
 const q=createWorldQueries({gateOpen:()=>true}),x=1370,z=-1030,y=terrainHeight(x,z)+12;
 assert.equal(q.canAirTraverse({x,y,z},{x:x+1,y:y+1,z},2.97,2.85),true);
 assert.equal(q.canAirTraverse({x,y,z},{x,y:terrainHeight(x,z)-1,z},2.97,2.85),false);
 assert.equal(q.canAirTraverse({x,y:terrainHeight(x,z)+2001,z},{x,y:terrainHeight(x,z)+2002,z},2.97,2.85),false);
 assert.equal(q.canAirTraverse({x,y,z},{x:x+200,y,z},2.97,2.85),false);
 const wall=WALLS[0];assert.equal(q.canAirTraverse({x:wall.x,y:.2,z:wall.z},{x:wall.x,y:1,z:wall.z},2.97,2.85),false);
});
test('ground hit applies total recoil once through the same traversable path and stops at an obstacle',()=>{
 const q={canTraverse:()=>true,terrainHeight:()=>3};
 for(const fps of [30,60,120]){const r=createGroundCombatRecoil(),p={x:0,z:0,y:3};r.start({id:'a',dx:2,dz:-1});assert.equal(r.start({id:'a',dx:2,dz:-1}),false);for(let i=0;i<fps;i++)r.step(p,1/fps,q);assert.ok(Math.abs(p.x-2)<1e-8);assert.ok(Math.abs(p.z+1)<1e-8);assert.equal(r.active,false);}
 const r=createGroundCombatRecoil(),p={x:0,z:0,y:3};r.start({id:'b',dx:2,dz:0});r.step(p,1/60,{...q,canTraverse:()=>false});assert.equal(p.x,0);assert.equal(r.active,false);
});
function fixture(){const scene=new Group(),bone=new Bone(),mesh=new SkinnedMesh(new BoxGeometry(),new MeshBasicMaterial());scene.add(bone,mesh);mesh.bind(new Skeleton([bone]));return {scene,animations:['ground-idle','ground-walk','ground-claw','takeoff','flight','dive','sweep','land','hit','death'].map(n=>new AnimationClip(n,1,[]))};}
test('new creature load failure holds admission and retry releases only a complete animated asset',async()=>{
 let attempts=0;const root=new Group(),a=createRiftwingAsset({root,terrainHeight:()=>0,loadAsset:async()=>{if(!attempts++)throw Error('503');return fixture();}});
 assert.equal((await a.ready).status,'failed');const retry=a.retry();assert.equal(a.assetStatus.status,'loading');assert.equal((await retry).status,'ready');
 a.update({time:1,player:{x:0,z:0},enemies:[{id:'test',kind:'riftwing',x:0,y:2,z:0,alive:true,mode:'air',phase:'chase'}]});assert.equal(a.snapshot()[0].clip,'flight');
 a.update({time:2,player:{x:0,z:0},enemies:[{id:'test',kind:'riftwing',x:0,y:0,z:0,alive:false,mode:'dead',phase:'dead'}]});assert.equal(a.snapshot()[0].clip,'death');a.dispose();assert.equal(root.children.length,0);assert.equal(a.assetStatus.status,'disposed');
});
