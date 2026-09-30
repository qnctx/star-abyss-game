const test=require('node:test');
const assert=require('node:assert/strict');
const modules=Promise.all([import('../src/mobility.mjs'),import('../src/movement.mjs'),import('../src/layout.mjs'),import('../src/camera.mjs')]);
const setup=async()=>Object.assign({},...await modules);
function advance(m,p,state,seconds,controls={}) {let motion;for(let i=0;i<Math.ceil(seconds*60);i++)motion=m.stepMobility(p,state,controls,1/60);return motion;}

test('new mobility retains ordinary walking and exact grounded eye height',async()=>{
  const m=await setup(),p=m.createPlayer(),walking=m.createPlayer(),state=m.createMobility();
  for(let i=0;i<120;i++){m.movePlayer(walking,{forward:true},1/60);m.stepMobility(p,state,{forward:true},1/60);}
  assert.equal(p.x,walking.x);assert.equal(p.z,walking.z);assert.equal(m.eyePosition(p).y,1.72);
  assert.equal(m.mobilityView(p,state).mode,'foot');
});

test('suit rises to a capped real altitude and camera follows the player',async()=>{
  const m=await setup(),p=m.createPlayer(),state=m.createMobility();
  advance(m,p,state,3,{lift:true});
  assert.equal(p.y,4.5);assert.ok(Math.abs(state.flight.energy-90)<1e-7);assert.equal(state.flight.thrusting,true);
  assert.equal(m.resolveCamera(p,'first').position.y,6.22);
  assert.equal(m.mobilityView(p,state).mode,'flight');
  advance(m,p,state,3,{});
  assert.equal(state.flight.airborne,false);assert.equal(p.y,0);assert.equal(m.eyePosition(p).y,1.72);
});

test('held Space exhausts once, forces landing and cannot recharge or bounce',async()=>{
  const m=await setup(),p=m.createPlayer(),state=m.createMobility();
  advance(m,p,state,40,{lift:true});
  assert.equal(state.flight.energy,0);assert.equal(state.flight.airborne,false);assert.equal(p.y,0);
  advance(m,p,state,4,{lift:true});assert.equal(state.flight.energy,0);
  advance(m,p,state,3,{});assert.ok(state.flight.energy>0&&state.flight.energy<25);
  advance(m,p,state,.1,{lift:true});assert.equal(state.flight.airborne,false);
  advance(m,p,state,3,{});advance(m,p,state,.1,{lift:true});assert.equal(state.flight.airborne,true);
});

test('low flight clears a real boulder and lands on its actual visible surface',async()=>{
  const m=await setup(),p={...m.createPlayer(),x:24,z:134},state=m.createMobility();
  advance(m,p,state,1,{lift:true});
  advance(m,p,state,.6,{lift:true,forward:true});assert.ok(p.z<130);
  // Start a descent directly above the fixed reference rock.
  p.x=24;p.z=130;p.y=3;p.vx=0;p.vz=0;
  advance(m,p,state,3,{});
  assert.equal(state.flight.airborne,false);
  assert.ok(Math.abs(p.y-m.supportHeight(p.x,p.z,.42))<.03);
  assert.ok(p.y>1.5&&p.y<1.9);
});

test('flight cannot start inside the wreck or bypass a sealed bulkhead',async()=>{
  const m=await setup(),p={...m.createPlayer(),x:0,z:-705},state=m.createMobility();
  advance(m,p,state,1,{lift:true});assert.equal(state.flight.airborne,false);assert.equal(p.y,0);
  assert.match(m.mobilityView(p,state).status,/禁用/);
  assert.equal(m.collidesAtHeight(0,-711,4.5,false),true);
  assert.equal(m.collidesAtHeight(0,-711,4.5,true),false);
});

test('transport has a connected salvage, repair, mount, brake and dismount loop',async()=>{
  const m=await setup(),state=m.createMobility(),p={...m.createPlayer(),x:72,z:83};
  assert.equal(m.mobilityAction(p,state,'skimmer').changed,false);assert.equal(state.vehicle.repaired,false);
  p.x=98;p.z=64;assert.equal(m.mobilityAction(p,state,'skimmer-part').changed,true);
  assert.equal(m.mobilityPoints(state).some(p=>p.id==='skimmer-part'),false);
  assert.equal(m.mobilityAction(p,state,'skimmer-part').changed,false);
  p.x=72;p.z=83;assert.equal(m.mobilityAction(p,state,'skimmer').changed,true);
  assert.equal(state.vehicle.repaired,true);assert.equal(state.vehicle.coupler,false);
  assert.equal(m.mobilityAction(p,state,'skimmer').changed,true);assert.equal(state.vehicle.mounted,true);
  advance(m,p,state,1.5,{forward:true});assert.ok(Math.hypot(p.vx,p.vz)>10);
  assert.equal(m.mobilityAction(p,state,'dismount').changed,false);
  advance(m,p,state,1,{lift:true});assert.ok(Math.hypot(p.vx,p.vz)<.1);
  p.yaw=1.7;p.heading=-.8;
  assert.equal(m.mobilityAction(p,state,'dismount').changed,true);assert.equal(state.vehicle.mounted,false);
  assert.equal(p.heading,state.vehicle.yaw);assert.equal(p.yaw,1.7);
  assert.ok(Math.hypot(p.x-state.vehicle.x,p.z-state.vehicle.z)>2);
});

test('vehicle battery spends distance, does not refill aboard, charges only parked',async()=>{
  const m=await setup(),state=m.createMobility(),p=m.createPlayer();
  state.vehicle.repaired=true;state.vehicle.mounted=true;state.vehicle.x=0;state.vehicle.z=180;p.z=180;
  const before=state.vehicle.battery;advance(m,p,state,3.5,{forward:true,boost:true});
  assert.ok(state.vehicle.battery<before);assert.ok(Math.hypot(p.vx,p.vz)>30);
  advance(m,p,state,1.5,{lift:true});const stopped=state.vehicle.battery;
  advance(m,p,state,2,{lift:true});assert.ok(state.vehicle.battery<=stopped);
  assert.equal(m.mobilityAction(p,state,'dismount').changed,true);
  advance(m,p,state,2,{});assert.ok(state.vehicle.battery>stopped);
});

test('vehicle refuses ship entry and camera uses collision-safe wider chase',async()=>{
  const m=await setup(),state=m.createMobility(),p={...m.createPlayer(),x:0,z:-460};
  Object.assign(state.vehicle,{x:0,z:-460,repaired:true,mounted:true});
  let blocked=false;for(let i=0;i<180;i++){const motion=m.stepMobility(p,state,{forward:true},1/60);blocked ||= motion.blocked;}
  assert.ok(blocked);assert.ok(p.z>-469);assert.equal(m.insideWreck(p.x,p.z),false);
  const camera=m.resolveCamera({...m.createPlayer(),z:100,y:0},'vehicle');assert.equal(camera.mode,'vehicle');assert.ok(camera.distance>6);assert.equal(m.cameraBlocked(camera.position),false);
});

test('mobility persistence validates old/corrupt data and restores in-air descent',async()=>{
  const m=await setup(),p=m.createPlayer(),state=m.createMobility();
  advance(m,p,state,1,{lift:true});const saved=m.serializeMobility(state),restoredPlayer=m.restorePlayer({...p});
  const restored=m.restoreMobility(saved,restoredPlayer);
  assert.equal(restored.flight.airborne,true);assert.equal(restored.flight.thrusting,false);assert.equal(restored.flight.liftHeld,false);
  advance(m,restoredPlayer,restored,3,{});assert.equal(restored.flight.airborne,false);
  assert.equal(m.restoreMobility(null,m.createPlayer()).flight.energy,100);
  const corrupt=m.restoreMobility({flight:{energy:-100},vehicle:{x:0,z:-700,mounted:true,repaired:true,battery:999}},m.createPlayer());
  assert.equal(corrupt.flight.energy,0);assert.equal(corrupt.vehicle.battery,100);assert.equal(corrupt.vehicle.x,72);assert.equal(corrupt.vehicle.z,80);
});

test('saving above a boulder restores same world position instead of spawn teleport',async()=>{
  const m=await setup(),p=m.restorePlayer({x:24,z:130,y:3,yaw:.2});
  assert.equal(p.x,24);assert.equal(p.z,130);assert.equal(p.y,3);
  const state=m.restoreMobility({flight:{energy:40}},p);assert.equal(state.flight.airborne,true);
  advance(m,p,state,3,{});assert.equal(p.x,24);assert.equal(p.z,130);assert.ok(p.y>1.5);
});

test('zero simulation delta freezes both suit and vehicle energy',async()=>{
  const m=await setup(),p=m.createPlayer(),state=m.createMobility();state.vehicle.battery=30;state.flight.energy=30;
  const before=JSON.stringify(state);m.stepMobility(p,state,{lift:true,forward:true},0);assert.equal(JSON.stringify(state),before);
});

test('flight ceiling is relative to sloped terrain without falling through it',async()=>{
  const m=await setup(),p={...m.createPlayer(),x:220,z:100},state=m.createMobility();
  // Select a clear starting point while retaining actual non-flat terrain.
  while(m.collides(p.x,p.z))p.x+=4;
  const initial=m.terrainHeight(p.x,p.z);
  assert.ok(Math.abs(initial)>.1);
  for(let i=0;i<270;i++) {
    m.stepMobility(p,state,{lift:true,forward:true},1/60);
    const altitude=p.y-m.terrainHeight(p.x,p.z);
    assert.ok(Number.isFinite(altitude));assert.ok(altitude>=0&&altitude<=m.MOBILITY.maxAltitude+.001);
  }
});

test('malformed resource data stays finite and cannot lose a recovered repair part',async()=>{
  const m=await setup(),p=m.createPlayer();
  for(const raw of [null,42,'broken',{flight:{energy:NaN,recoveryRemaining:Infinity},vehicle:{x:Infinity,z:NaN,battery:-Infinity,yaw:NaN}},{vehicle:{partTaken:true,coupler:false,repaired:false}}]) {
    const state=m.restoreMobility(raw,p);const view=m.mobilityView(p,state);
    for(const key of ['energy','altitude','battery','speed'])assert.ok(Number.isFinite(view[key]));
    assert.ok(view.energy>=0&&view.energy<=100);assert.ok(view.battery>=0&&view.battery<=100);
  }
  const recovered=m.restoreMobility({vehicle:{partTaken:true,coupler:false,repaired:false}},p);
  assert.equal(recovered.vehicle.coupler,true);
});

test('no collection from the air or a mounted vehicle and no remote repair',async()=>{
  const m=await setup(),p={...m.createPlayer(),x:98,z:64},state=m.createMobility();
  state.flight.airborne=true;assert.equal(m.mobilityAction(p,state,'skimmer-part').changed,false);
  state.flight.airborne=false;state.vehicle.mounted=true;assert.equal(m.mobilityAction(p,state,'skimmer-part').changed,false);
  state.vehicle.mounted=false;assert.equal(m.mobilityAction(p,state,'skimmer-part').changed,true);
  assert.equal(m.mobilityAction(p,state,'skimmer').changed,false);
});

test('descending onto a parked vehicle lands on its hull and can walk off safely',async()=>{
  const m=await setup(),state=m.createMobility(),p={...m.createPlayer(),...m.MOBILITY.vehicleSpawn};
  const ground=m.terrainHeight(p.x,p.z);p.y=ground+3;state.flight.airborne=true;
  advance(m,p,state,3,{});
  assert.equal(state.flight.airborne,false);assert.ok(Math.abs(p.y-m.parkedVehicleSurfaceHeight(p.x,p.z,state.vehicle))<.02);
  advance(m,p,state,3,{forward:true});
  assert.ok(Math.hypot(p.x-state.vehicle.x,p.z-state.vehicle.z)>3);assert.equal(state.flight.airborne,false);
  assert.ok(Math.abs(p.y-m.terrainHeight(p.x,p.z))<.03);
});

test('legacy saves inside the new parked vehicle move to nearby clear ground, not spawn',async()=>{
  const m=await setup(),p={...m.createPlayer(),...m.MOBILITY.vehicleSpawn};
  p.y=m.terrainHeight(p.x,p.z);
  const state=m.restoreMobility(undefined,p);
  const distance=Math.hypot(p.x-state.vehicle.x,p.z-state.vehicle.z);
  assert.ok(distance>=1.35&&distance<3,'migration should resolve the new local collider with a small safe offset');
  assert.equal(state.flight.airborne,false);assert.equal(m.collides(p.x,p.z),false);
  const before={x:p.x,z:p.z};advance(m,p,state,2,{right:true});
  assert.ok(Math.hypot(p.x-before.x,p.z-before.z)>3,'walking must not require a rescue flight');
  assert.equal(m.mobilityView(p,state).maxAltitude,m.MOBILITY.maxAltitude);
});

test('save reload on a parked vehicle roof preserves position and still permits stepping off',async()=>{
  const m=await setup(),state=m.createMobility(),p={...m.createPlayer(),...m.MOBILITY.vehicleSpawn};
  p.y=m.parkedVehicleSurfaceHeight(p.x,p.z,state.vehicle);
  const saved=m.serializeMobility(state),restoredPlayer=m.restorePlayer(p),restored=m.restoreMobility(saved,restoredPlayer);
  assert.equal(restoredPlayer.x,p.x);assert.equal(restoredPlayer.z,p.z);assert.equal(restoredPlayer.y,p.y);
  advance(m,restoredPlayer,restored,.1,{});assert.equal(restored.flight.airborne,false);
  advance(m,restoredPlayer,restored,3,{forward:true});
  assert.ok(Math.hypot(restoredPlayer.x-restored.vehicle.x,restoredPlayer.z-restored.vehicle.z)>3);
  assert.equal(restored.flight.airborne,false);assert.ok(Math.abs(restoredPlayer.y-m.terrainHeight(restoredPlayer.x,restoredPlayer.z))<.03);
});

test('map ground queries use the same parked vehicle collider as walking and restore',async()=>{
  const m=await setup(),state=m.createMobility(),v=state.vehicle;
  assert.equal(m.collides(v.x,v.z),false,'vehicle recovery site is otherwise clear');
  assert.equal(m.groundMobilityBlocked(v.x,v.z,state),true);
  assert.equal(m.groundMobilityBlocked(v.x+1,v.z,state),true);
  assert.equal(m.groundMobilityBlocked(v.x+2,v.z,state),false);
  assert.equal(m.groundMobilityBlocked(24,130,state),true,'static boulders remain blocked too');
  assert.equal(m.groundMobilityBlocked(0,-711,state,false),true);
  assert.equal(m.groundMobilityBlocked(0,-711,state,true),false);
});
