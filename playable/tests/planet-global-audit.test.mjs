import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPlanetRuntime} from '../src/planet-runtime.mjs';
import {createMobility,serializeMobility,stepMobility,mobilityAction} from '../src/mobility.mjs';
import {unit,scale,localToGlobal} from '../src/planet/coordinates.mjs';
import {insideWreck} from '../src/layout.mjs';

// Independent integration evidence. Uses real field/chunks/gameplay/runtime/Three;
// no browser storage, production saves, geometry substitutes, or product edits.
const progression={surveys:['plains','forest','wetland','coast'],commissioned:true};
function fixture(){
  const scene=new THREE.Scene();scene.fog={density:.001};
  const context={player:{x:0,y:0,z:190,yaw:0,heading:0,pitch:0},story:{flags:{complete:true,gateOpen:true}},mobility:createMobility()};context.mobility.vehicle.repaired=true;
  const runtime=createPlanetRuntime({world:{scene,setPlanetController(){}},getContext:()=>context,toast(){}});
  const legacy={version:1,player:{...context.player},story:context.story,mobility:serializeMobility(context.mobility)};
  runtime.reset(legacy);const base=runtime.save(legacy);
  const snapshot=(position,extra={})=>({...base,planet:{...base.planet,position,gameplay:{version:1,energy:100,progression,...extra}}});
  return {runtime,context,scene,legacy,base,snapshot};
}
test('opposite-meridian camp projection is not an actual service point',()=>{
  const f=fixture();try{
    // Elevated probe bypasses pending close-ground LOD, while retaining camp XZ.
    const p={x:-130000,y:-190,z:0};f.runtime.prepare(p);
    const s=f.runtime.adapter.sample(p);assert.equal(s.ready,true);
    assert.equal(s.atService,false,'antipodal XZ projection must not grant camp service');
  }finally{f.runtime.dispose();}
});
test('backside landed walk takeoff save retains canonical hemisphere and parking',()=>{
  const f=fixture();try{
    f.context.realm=4; // Current flight gate requires R4, not ecological commissioning.
    const p=f.runtime.field.surfacePoint({x:-1,y:0,z:0}),support=f.runtime.prepare(p);
    assert.equal(support.ready,true);f.runtime.reset(f.snapshot(support.position));
    assert.equal(f.runtime.legacyActive(),false);assert.equal(f.runtime.active,false);
    const before={...f.runtime.position};assert.equal(f.runtime.step({forward:true},1/60),true);
    assert.ok(Math.hypot(...['x','y','z'].map(k=>f.runtime.position[k]-before[k]))>0);
    assert.ok(f.runtime.position.x<0);assert.equal(f.runtime.step({lift:true},1/60),true);assert.equal(f.runtime.active,true);
    const saved=f.runtime.save({...f.legacy,player:{...f.context.player}});
    assert.deepEqual(saved.player,f.base.player);assert.ok(saved.planet.position.x<0);
    const parked={...saved.planet.gameplay.surfaceVehicle.position};f.runtime.reset(saved);
    assert.ok(f.runtime.position.x<0);assert.deepEqual(f.runtime.save(f.legacy).planet.gameplay.surfaceVehicle.position,parked);
  }finally{f.runtime.dispose();}
});
test('polar seabed saves reject and nearby dry polar ground never becomes legacy basin',t=>{
  const f=fixture();try{
    for(const sign of [1,-1]){
      const p=f.runtime.field.surfacePoint({x:0,y:sign,z:0});let support=f.runtime.prepare(p);assert.equal(support.ready,true);
      t.diagnostic(JSON.stringify({pole:sign,support:{height:support.height,waterDepth:support.waterDepth,slope:support.slope,spacing:support.spacing},sample:f.runtime.adapter.sample(support.position)}));
      if(support.waterDepth>.15){assert.throws(()=>f.runtime.reset(f.snapshot(support.position)),/unsafe/);
        let dry=null;
        search:for(let angle=5;angle<=35;angle+=5)for(let azimuth=0;azimuth<360;azimuth+=15){
          const a=angle*Math.PI/180,b=azimuth*Math.PI/180,d={x:Math.sin(a)*Math.cos(b),y:sign*Math.cos(a),z:Math.sin(a)*Math.sin(b)},s=f.runtime.field.sampleSurface(d);
          if(s.waterDepth===0&&s.slope<.4){dry=d;break search;}
        }
        assert.ok(dry,'real dry ground must be selected within 35 degrees of pole');support=f.runtime.prepare(f.runtime.field.surfacePoint(dry));
        assert.equal(support.ready,true);assert.ok(support.waterDepth<=.15);
      }
      f.runtime.reset(f.snapshot(support.position));assert.equal(f.runtime.legacyActive(),false);assert.equal(f.runtime.radialFrame(),true);
      const saved=f.runtime.save(f.legacy);assert.equal(Math.sign(saved.planet.position.y),sign);
    }
  }finally{f.runtime.dispose();}
});
test('backside wreck projection permits takeoff and canonical parking roundtrips',()=>{
  const f=fixture();try{
    f.context.realm=4; // Test global takeoff with the real cultivation prerequisite.
    const surface=f.runtime.prepare(f.runtime.field.surfacePoint({x:-120000,y:600,z:0}));assert.equal(surface.ready,true);assert.ok(surface.waterDepth<=.15);
    f.runtime.reset(f.snapshot(surface.position));assert.equal(insideWreck(f.context.player.x,f.context.player.z),true);
    assert.equal(f.runtime.step({lift:true},1/60),true);assert.equal(f.runtime.active,true);
    const vehicle={position:{...surface.position},yaw:.4,battery:80,mounted:true};
    f.runtime.reset(f.snapshot(surface.position,{surfaceVehicle:vehicle}));assert.equal(f.context.mobility.vehicle.mounted,true);
    assert.equal(f.runtime.step({forward:true},1/60),true);assert.ok(f.runtime.position.x<0);
    assert.ok(f.context.mobility.vehicle.battery<80);
    assert.equal(f.runtime.vehicleAction(),true);assert.equal(f.context.mobility.vehicle.mounted,false);
    const saved=f.runtime.save(f.legacy);assert.ok(saved.planet.gameplay.surfaceVehicle.position.x<0);assert.equal(saved.planet.gameplay.surfaceVehicle.mounted,false);
    const parked={...saved.planet.gameplay.surfaceVehicle.position};f.runtime.reset(saved);
    assert.deepEqual(f.runtime.save(f.legacy).planet.gameplay.surfaceVehicle.position,parked);
    assert.equal(f.runtime.vehicleAction(),true);assert.equal(f.context.mobility.vehicle.mounted,true);
    assert.deepEqual(f.runtime.position,parked);
  }finally{f.runtime.dispose();}
});
test('same-frame parent rebase and save followed by undo has no accumulated drift',()=>{
  const f=fixture();try{
    const p=scale(unit({x:-1,y:.3,z:.2}),220000);f.runtime.reset(f.snapshot(p));
    const camera=new THREE.PerspectiveCamera(),parent=new THREE.Group(),child=new THREE.Group();parent.position.set(1234,5678,-923);child.position.set(17,19,23);parent.add(child);f.scene.add(camera,parent);
    const objects={scene:f.scene,camera};for(const key of ['ground','avatar','skimmer','sky','stars','ringPlanet','ringGroup','dust']){objects[key]=new THREE.Group();f.scene.add(objects[key]);}
    objects.sky.material={uniforms:{orbitalMix:{value:0}}};
    const view={player:f.context.player,mobility:f.context.mobility,cameraMode:'first'};
    const original=parent.position.clone(),relative=child.position.clone();
    for(let i=0;i<4;i++){
      f.runtime.updateScene(view,objects);assert.ok(parent.position.distanceTo(original)>1000);
      const saved=f.runtime.save(f.legacy);assert.deepEqual(saved.planet.position,p);
      f.runtime.finishScene();assert.ok(parent.position.distanceTo(original)<1e-8);assert.deepEqual(child.position,relative);
    }
    assert.equal(f.runtime.setMapTarget({id:'survey:coast'}),true);
    const targetBefore=f.runtime.navigation(),saved=f.runtime.save(f.legacy);f.runtime.reset(saved);assert.deepEqual(f.runtime.position,p);
    const targetAfter=f.runtime.navigation();assert.equal(targetAfter.kind,'custom');assert.equal(targetAfter.target.id,'survey:coast');assert.equal(targetAfter.distance,targetBefore.distance);
    assert.equal(f.runtime.setMapTarget(null),true);const cleared=f.runtime.save(f.legacy);f.runtime.reset(cleared);assert.notEqual(f.runtime.navigation()?.kind,'custom');
  }finally{f.runtime.finishScene();f.runtime.dispose();}
});
test('uncommissioned east-route local driving parking and save at four real landmarks',t=>{
  const f=fixture();try{
    for(const distance of [8000,17000,27000,34000]){
      const support=f.runtime.prepare(f.runtime.field.surfacePoint(f.runtime.field.routeDirection(distance)));
      assert.equal(support.ready,true);assert.ok(support.waterDepth<=.15);
      const vehicle={position:{...support.position},yaw:-Math.PI/2,battery:80,mounted:true};
      f.runtime.reset(f.snapshot(support.position,{progression:{surveys:[],commissioned:false},surfaceVehicle:vehicle}));
      assert.equal(f.runtime.radialFrame(),false);assert.equal(f.runtime.hud().unlocked,false);
      f.context.player.vx=0;f.context.player.vz=0;
      const before={...f.context.player};
      const handled=f.runtime.step({forward:true},.05);assert.equal(handled,false);
      const motion=stepMobility(f.context.player,f.context.mobility,{forward:true},.05,true);
      t.diagnostic(JSON.stringify({distance,motion,from:before,to:f.context.player,sample:f.runtime.adapter.sample(localToGlobal(f.context.player))}));
      assert.ok(motion.distance>0,`drive at ${distance}`);
      // Stop and use the same legacy dismount action main uses before radial threshold.
      f.context.player.vx=0;f.context.player.vz=0;
      const dismount=mobilityAction(f.context.player,f.context.mobility,'dismount',true);assert.equal(dismount.changed,true,`dismount at ${distance}`);
      const saved=f.runtime.save(f.legacy);f.runtime.reset(saved);
      assert.ok(Math.hypot(...['x','y','z'].map(k=>f.runtime.position[k]-saved.planet.position[k]))<1e-6);
    }
  }finally{f.runtime.dispose();}
});
test('global parked vehicle retains passive solar recharge while explorer stands nearby',()=>{
  const f=fixture();try{
    const support=f.runtime.prepare(f.runtime.field.surfacePoint({x:-1,y:0,z:0}));
    f.runtime.reset(f.snapshot(support.position,{surfaceVehicle:{position:{...support.position},yaw:0,battery:0,mounted:false}}));
    for(let i=0;i<60;i++)assert.equal(f.runtime.step({},1/60),true);
    assert.ok(f.context.mobility.vehicle.battery>0,'global handled branch must preserve parked vehicle recharge');
  }finally{f.runtime.dispose();}
});
test('global vehicle accelerates brakes reverses and consumes battery by actual distance',()=>{
  const f=fixture();try{
    const s=f.runtime.prepare(f.runtime.field.surfacePoint({x:-1,y:0,z:0}));
    f.runtime.reset(f.snapshot(s.position,{surfaceVehicle:{position:{...s.position},yaw:0,battery:80,mounted:true}}));
    f.context.player.vx=f.context.player.vz=0;let distance=0;
    for(let i=0;i<8;i++){const p={...f.runtime.position};assert.equal(f.runtime.step({forward:true},.05),true);distance+=Math.hypot(...['x','y','z'].map(k=>f.runtime.position[k]-p[k]));}
    assert.ok(Math.abs(Math.hypot(f.context.player.vx,f.context.player.vz)-3.6)<1e-8);
    assert.ok(Math.abs(80-f.context.mobility.vehicle.battery-distance*.01)<1e-8);
    for(let i=0;i<3;i++)f.runtime.step({lift:true},.05);
    assert.equal(Math.hypot(f.context.player.vx,f.context.player.vz),0);
    for(let i=0;i<30;i++)f.runtime.step({backward:true},.05);
    assert.ok(Math.abs(f.context.player.vz-10)<1e-8,'reverse cap is 10m/s');
  }finally{f.runtime.dispose();}
});
test('global moving vehicle refuses dismount until safe stopped speed',()=>{
  const f=fixture();try{
    const s=f.runtime.prepare(f.runtime.field.surfacePoint({x:-1,y:0,z:0}));
    f.runtime.reset(f.snapshot(s.position,{surfaceVehicle:{position:{...s.position},yaw:0,battery:80,mounted:true}}));
    f.context.player.vx=f.context.player.vz=0;for(let i=0;i<8;i++)f.runtime.step({forward:true},.05);
    assert.ok(Math.hypot(f.context.player.vx,f.context.player.vz)>2);
    assert.equal(f.runtime.vehicleAction(),false,'moving dismount must retain legacy safety rule');
  }finally{f.runtime.dispose();}
});
test('uncommissioned global low-flight input never delegates to legacy tangent physics',()=>{
  const f=fixture();try{
    const s=f.runtime.prepare(f.runtime.field.surfacePoint({x:-1,y:0,z:0}));
    f.runtime.reset(f.snapshot(s.position,{progression:{surveys:[],commissioned:false}}));
    assert.equal(f.runtime.radialFrame(),true);assert.equal(f.runtime.hud().unlocked,false);
    const handled=f.runtime.step({lift:true},.05);
    if(!handled)stepMobility(f.context.player,f.context.mobility,{lift:true},.05,true);
    f.runtime.syncGround();
    assert.ok(f.runtime.position.x<0,'locked global lift must not let real legacy fallback snap player to front hemisphere');
  }finally{f.runtime.dispose();}
});
