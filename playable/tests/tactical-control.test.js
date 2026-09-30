const test=require('node:test'),assert=require('node:assert/strict');
let control,movement,mobility,pose,camera;
test.before(async()=>{[control,movement,mobility,pose,camera]=await Promise.all([import('../src/tactical-control.mjs'),import('../src/movement.mjs'),import('../src/mobility.mjs'),import('../src/tactical-pose.mjs'),import('../src/camera.mjs')]);});
test('tactical pace, diagonal cap, Ctrl priority and short stopping distance',()=>{
 const speeds=[];
 for(const [posture,walk,sprint] of [['stand',false,false],['stand',false,true],['stand',true,true],['crouch',false,true],['prone',false,true]]){
  const p={...movement.createPlayer(),posture};
  for(let i=0;i<120;i++)movement.movePlayer(p,control.updateTacticalControl(p,{forward:true,walk,sprint},1/60),1/60,false,{collides:()=>false});
  speeds.push(Math.hypot(p.vx,p.vz));
  const z=p.z;for(let i=0;i<30;i++)movement.movePlayer(p,{tactical:true},1/60,false,{collides:()=>false});
  assert.ok(Math.abs(p.z-z)<.35);assert.ok(Math.hypot(p.vx,p.vz)<.001);
 }
 for(const [i,expected] of [4.7,6.3,1.65,4.7*.52,4.7*.18].entries())assert.ok(Math.abs(speeds[i]-expected)<.001);
});
test('stance changes reject airborne, vehicle and solid wall; lean cancels during sprint',()=>{
 const p=movement.createPlayer();assert.equal(control.setPosture(p,'crouch'),true);
 assert.equal(control.setPosture(p,'prone',{airborne:true}),false);assert.equal(control.setPosture(p,'prone',{mounted:true}),false);
 assert.equal(control.setPosture({...p,x:3001},'stand'),false);
 for(let i=0;i<60;i++)control.updateTacticalControl(p,{leanLeft:true},1/60);
 assert.ok(p.lean<-.99);assert.ok(Math.abs(p.eyeHeight-1.05)<.001);
 p.posture='stand';for(let i=0;i<60;i++)control.updateTacticalControl(p,{forward:true,sprint:true},1/60);
 assert.ok(Math.abs(p.lean)<.001);
});
test('long-held Space through tactical control and real mobility jumps once, lands, and never jets',()=>{
 const p=movement.createPlayer(),m=mobility.createMobility();let max=0,takeoffs=0,last=false;
 for(let i=0;i<180;i++){
  const c=control.updateTacticalControl(p,{jump:true},1/60,{airborne:m.jump.airborne||m.flight.airborne});
  assert.equal(c.lift,false);mobility.stepMobility(p,m,c,1/60);max=Math.max(max,p.y);
  assert.equal(m.flight.airborne,false);assert.equal(m.flight.thrusting,false);
  if(m.jump.airborne&&!last)takeoffs++;last=m.jump.airborne;
 }
 assert.ok(max>.8&&max<.9);assert.equal(takeoffs,1);assert.equal(p.y,0);assert.equal(m.flight.energy,100);assert.equal(m.flight.airborne,false);
 mobility.stepMobility(p,m,control.updateTacticalControl(p,{},1/60),1/60);
 mobility.stepMobility(p,m,control.updateTacticalControl(p,{jump:true},1/60),1/60);assert.equal(m.jump.airborne,true);
});
test('Space hold never becomes lift; G remains lift and mounted Space remains the input brake',()=>{
 const p=movement.createPlayer();let c;
 for(let i=0;i<12;i++)c=control.updateTacticalControl(p,{jump:true},1/60);assert.equal(c.lift,false);
 control.updateTacticalControl(p,{},1/60);assert.equal(p.spaceHoldTime,0);
 for(let i=0;i<120;i++)c=control.updateTacticalControl(p,{jump:true},1/60);assert.equal(c.lift,false);
 c=control.updateTacticalControl(p,{},1/60);assert.equal(c.lift,false);
 c=control.updateTacticalControl(p,{lift:true},1/60);assert.equal(c.lift,true);
 for(let i=0;i<60;i++)c=control.updateTacticalControl(p,{jump:true},1/60,{mounted:true});assert.equal(c.lift,false);
});
test('prone accepts gentle terrain slopes while preserving solid collisions',async()=>{
 const layout=await import('../src/layout.mjs');let found=0;
 for(let x=100;x<125;x+=2)for(let z=100;z<125;z+=2){const p={...movement.createPlayer(),x,z,y:layout.terrainHeight(x,z)};
  if(!control.postureBlocked(p,'stand')&&!control.postureBlocked(p,'prone')){assert.equal(control.setPosture(p,'prone'),true);found++;}
 }assert.ok(found>10);
 assert.equal(control.setPosture({...movement.createPlayer(),x:3001},'prone'),false);
});
test('low postures drive full body poses and lower the camera without clipping its lean through walls',()=>{
 const direction={forward:1,backward:0,left:0,right:0};
 for(const fn of [pose.crouchPose,pose.pronePose])for(let i=0;i<60;i++){
  const p=fn(i/60,1,direction);assert.ok(p.position.every(Number.isFinite));assert.ok(p.rotations.every(q=>Math.abs(q.length()-1)<1e-6));
  assert.ok(p.position[1]<-.2);
 }
 const player={...movement.createPlayer(),eyeHeight:.38,lean:1};
 const c=camera.resolveCamera(player);assert.ok(c.position.y<.4);assert.ok(!camera.cameraBlocked(c.position));
});
