const {test}=require('node:test');
const assert=require('node:assert/strict');
test('walking test routes around the actual parked vehicle after dismount',async()=>{
  const {routeWaypoints}=require('./walk-route.js');
  const {createMobility,groundMobilityBlocked}=await import('../src/mobility.mjs');
  const state=createMobility();Object.assign(state.vehicle,{x:0,z:170,repaired:true,mounted:false});
  let from={x:2.5,z:170};const route=await routeWaypoints(from,{x:-2.5,z:170},false,state);
  assert.ok(route.length>1,'straight line would cross the parked vehicle');
  for(const to of route){
    const steps=Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/.1);
    for(let i=0;i<=steps;i++)assert.equal(groundMobilityBlocked(from.x+(to.x-from.x)*i/steps,from.z+(to.z-from.z)*i/steps,state),false);
    from=to;
  }
});
for(const [name,start,targets] of [
  ['southwest',{x:72,z:80,yaw:0},[{x:0,z:120}]],
  ['nearby parking',{x:0,z:180,yaw:0},[{x:1,z:178}]],
  ['sharp corner',{x:0,z:180,yaw:0},[{x:0,z:160},{x:-20,z:160}]],
  ['diagonal',{x:0,z:180,yaw:0},[{x:20,z:150}]],
  ['old remote route first waypoint',{x:72,z:80,yaw:0},[{x:-11.7142857,z:121.5714286}]],
]) test(`test driver reaches ${name} using controls, not camera or position mutation`,async()=>{
  const {planVehicleControls}=await import('./vehicle-route-planner.mjs');
  const {createMobility,stepMobility}=await import('../src/mobility.mjs');
  const {terrainHeight}=await import('../src/layout.mjs');
  const state=createMobility();Object.assign(state.vehicle,{...start,repaired:true,mounted:true});
  const player={...start,y:terrainHeight(start.x,start.z),vx:0,vz:0,pitch:0};
  for(const target of targets){
    const before=structuredClone({player,state});const plan=planVehicleControls(player,state,target);
    assert.deepEqual({player,state},before,'prediction must not mutate actual state');
    for(const segment of plan.segments)for(let i=0;i<segment.frames;i++)assert.equal(stepMobility(player,state,segment.input,1/60,false).blocked,false);
    assert.ok(Math.hypot(target.x-player.x,target.z-player.z)<.5);
    assert.ok(Math.hypot(player.vx,player.vz)<.001);
    assert.equal(player.yaw,start.yaw,'mouse look remains independent');
  }
});
