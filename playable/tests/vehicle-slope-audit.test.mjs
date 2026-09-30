import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {terrainHeight,configureWorldExtension} from '../src/layout.mjs';
import {sampleTerrainContact,advanceVerticalContact} from '../src/terrain-contact.mjs';
import {createMobility,stepMobility,serializeMobility,restoreMobility,mobilityAction,MOBILITY} from '../src/mobility.mjs';
import {createSkimmer} from '../src/vehicle-model.mjs';

function rig(x=-140,z=20,yaw=0){
  const state=createMobility();Object.assign(state.vehicle,{x,z,yaw,mounted:true,repaired:true,battery:80});
  const player={x,z,y:terrainHeight(x,z),yaw,pitch:0,heading:yaw,vx:0,vz:0};
  return {state,player};
}
function contact(player,state){return sampleTerrainContact({height:terrainHeight,x:player.x,z:player.z,yaw:state.vehicle.yaw});}
test('real terrain support plane and every visible hull vertex stay above the mountain at rest',()=>{
  // Node lacks the dashboard's 2D canvas. Stub text painting only; all Three
  // geometry, transforms, terrain and vehicle physics remain production code.
  const previousDocument=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
  const materials=[],skimmer=createSkimmer(materials),vertex=new THREE.Vector3();
  try{
    for(const [x,z] of [[-140,20],[220,40]])for(const yaw of [0,.7,Math.PI/2]){
      const {player,state}=rig(x,z,yaw);
      stepMobility(player,state,{},1/60,true);
      skimmer.update(state.vehicle,0,{});skimmer.root.updateMatrixWorld(true);
      let minimum=Infinity,vertices=0;
      skimmer.root.children[0].traverse(mesh=>{
        if(!mesh.isMesh)return;
        const positions=mesh.geometry.attributes.position;
        for(let i=0;i<positions.count;i++){
          vertex.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
          minimum=Math.min(minimum,vertex.y-terrainHeight(vertex.x,vertex.z));vertices++;
        }
      });
      assert.ok(vertices>1000);assert.ok(minimum>=-.015,`${x},${z} yaw=${yaw} hull clearance ${minimum}`);
      assert.ok(player.y>=terrainHeight(player.x,player.z)-1e-8);
    }
  }finally{skimmer.root.traverse(o=>o.geometry?.dispose());materials.forEach(m=>m.dispose());skimmer.dispose();globalThis.document=previousDocument;}
});
test('actual .69 slope uphill and downhill drive remain grounded without floating',()=>{
  const initial=sampleTerrainContact({height:terrainHeight,x:-140,z:20});
  assert.ok(initial.slope>.6&&initial.slope<.8);
  for(const direction of [-1,1]){
    const yaw=Math.atan2(-initial.gradient.x*direction,-initial.gradient.z*direction);
    const {state,player}=rig(-140,20,yaw);stepMobility(player,state,{},1/60,true);
    const start={...player};let travelled=0;
    for(let i=0;i<45;i++){
      const motion=stepMobility(player,state,{forward:true},1/60,true);travelled+=motion.distance;
      const c=contact(player,state);assert.ok(player.y>=terrainHeight(player.x,player.z)-1e-7);
      if(state.vehicle.grounded)assert.ok(Math.abs(player.y-c.height)<1e-7);
    }
    assert.ok(travelled>.5,`direction ${direction} travelled=${travelled}`);
    assert.ok((player.y-start.y)*direction>0,`slope movement direction ${direction}`);
  }
});
test('actual 1.15 grade releases downhill without throttle rather than remaining suspended',()=>{
  const {state,player}=rig(220,40);stepMobility(player,state,{},1/60,true);
  const start={...player};
  for(let i=0;i<90;i++)stepMobility(player,state,{},1/60,true);
  assert.ok(Math.hypot(player.x-start.x,player.z-start.z)>.1);
  assert.ok(player.y<start.y);
  assert.ok(player.y>=terrainHeight(player.x,player.z)-1e-7);
});
test('gravity-driven sliding speed is bounded and consistent across frame rates',()=>{
  configureWorldExtension({height:x=>1.15*(x-3500),blocked:()=>false,surface:()=> 'rock'});
  try{
    const speeds=[];
    for(const dt of [1/30,1/60,1/120]){
      const {state,player}=rig(3500,0,Math.PI/2);
      for(let i=0;i<Math.round(1/dt);i++)stepMobility(player,state,{},dt,true);
      speeds.push(Math.hypot(player.vx,player.vz));
    }
    assert.ok(Math.max(...speeds)<15,`one-second no-throttle slide speeds ${speeds.join(', ')}`);
    assert.ok(Math.max(...speeds)-Math.min(...speeds)<.6,`frame rate dependent speeds ${speeds.join(', ')}`);
  }finally{configureWorldExtension(null);}
});
test('a supported craft driving off a 4m ledge falls over time and lands without a height teleport',()=>{
  configureWorldExtension({height:x=>x<3500?4:0,blocked:()=>false,surface:()=> 'rock'});
  try{
    const {state,player}=rig(3498,0,-Math.PI/2);
    stepMobility(player,state,{},1/60,true);
    let airborne=false,landed=false,previous=player.y;
    for(let i=0;i<180;i++){
      stepMobility(player,state,{forward:true},1/60,true);
      if(state.vehicle.grounded===false){airborne=true;assert.ok(previous-player.y<.3);}
      if(airborne&&state.vehicle.grounded)landed=true;
      assert.ok(player.y>=0);previous=player.y;
    }
    assert.ok(airborne);assert.ok(landed);assert.equal(player.y,0);
  }finally{configureWorldExtension(null);}
});
test('vertical solver cannot manufacture upward motion across an unapproved step',()=>{
  assert.deepEqual(advanceVerticalContact({y:0,vy:0,grounded:true},2,1/60),{y:0,vy:0,grounded:true});
  assert.deepEqual(advanceVerticalContact({y:2,vy:0,grounded:true},NaN,1/60),{y:2,vy:0,grounded:true});
});
test('drive consumption matches real distance and held brake stops the craft on original terrain',()=>{
  const {state,player}=rig(0,80,0);let distance=0;
  for(let i=0;i<60;i++)distance+=stepMobility(player,state,{forward:true},1/60,true).distance;
  assert.ok(distance>3);assert.ok(Math.hypot(player.vx,player.vz)>8);
  assert.ok(Math.abs(state.vehicle.battery-(80-distance*MOBILITY.vehicleConsumption))<1e-8);
  for(let i=0;i<40;i++)stepMobility(player,state,{forward:true,lift:true},1/60,true);
  assert.ok(Math.hypot(player.vx,player.vz)<1e-7);
});
test('legacy save with no contact state preserves parked position repair and charge',()=>{
  const {state,player}=rig(-140,20,.4);state.vehicle.battery=37;
  const saved=serializeMobility(state),restored=restoreMobility(JSON.parse(JSON.stringify(saved)),player,true);
  assert.equal(restored.vehicle.battery,37);assert.equal(restored.vehicle.repaired,true);
  assert.equal(restored.vehicle.mounted,true);assert.equal(restored.vehicle.x,-140);assert.equal(restored.vehicle.z,20);
  stepMobility(player,restored,{},1/60,true);
  assert.ok(Number.isFinite(restored.vehicle.y));assert.ok(player.y>=terrainHeight(player.x,player.z));
});
test('dismounting and reboarding does not restore an old drive velocity without throttle',()=>{
  const {state,player}=rig(0,80,0);
  for(let i=0;i<10;i++)stepMobility(player,state,{forward:true},1/60,true);
  assert.ok(Math.hypot(player.vx,player.vz)>1&&Math.hypot(player.vx,player.vz)<2);
  assert.equal(mobilityAction(player,state,'dismount',true).changed,true);
  for(let i=0;i<60;i++)stepMobility(player,state,{},1/60,true);
  assert.equal(mobilityAction(player,state,'skimmer',true).changed,true);
  const before={...player};stepMobility(player,state,{},1/60,true);
  assert.ok(Math.hypot(player.x-before.x,player.z-before.z)<1e-8,'parked craft must remain stopped on reboarding');
});
test('saving during a real ledge fall resumes at the saved altitude instead of teleporting to its bottom',()=>{
  configureWorldExtension({height:x=>x<3500?4:0,blocked:()=>false,surface:()=> 'rock'});
  try{
    const {state,player}=rig(3498,0,-Math.PI/2);
    for(let i=0;i<180;i++){
      stepMobility(player,state,{forward:true},1/60,true);
      if(state.vehicle.grounded===false&&player.y-terrainHeight(player.x,player.z)>1)break;
    }
    assert.equal(state.vehicle.grounded,false);
    const savedY=player.y,saved=JSON.parse(JSON.stringify(serializeMobility(state)));
    const restored=restoreMobility(saved,player,true);
    assert.ok(Math.abs(player.y-savedY)<1e-7,`saved altitude ${savedY}, restored altitude ${player.y}`);
    stepMobility(player,restored,{},1/60,true);
    assert.ok(player.y<savedY&&savedY-player.y<.3,'continues gravity without snapping to the ground');
  }finally{configureWorldExtension(null);}
});
test('warm 1000 real terrain steps produce a measured CPU cost, not an inferred FPS',t=>{
  const {state,player}=rig(0,80,0);
  for(let i=0;i<100;i++)stepMobility(player,state,{},1/60,true);
  const start=performance.now();
  for(let i=0;i<1000;i++)stepMobility(player,state,{},1/60,true);
  const elapsed=performance.now()-start;
  t.diagnostic(`1000 warm stationary steps ${elapsed.toFixed(2)}ms (${(elapsed/1000).toFixed(4)}ms/step); excludes rendering`);
  assert.ok(Number.isFinite(elapsed));
});
