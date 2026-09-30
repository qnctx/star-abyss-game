const test=require('node:test');
const assert=require('node:assert/strict');
async function setup(){const m=await import('../src/mobility.mjs');const p={x:0,z:190,y:0,yaw:0,pitch:0,vx:0,vz:0};const s=m.createMobility();Object.assign(s.vehicle,{x:0,z:190,repaired:true,mounted:true});return {m,p,s};}
function step({m,p,s},controls,n=60){for(let i=0;i<n;i++)m.stepMobility(p,s,controls,1/60);}
test('camera rotation has no effect on forward driving or vehicle heading',async()=>{
 const a=await setup(),b=await setup();b.p.yaw=1.7;
 step(a,{forward:true});step(b,{forward:true});
 assert.equal(a.p.x,b.p.x);assert.equal(a.p.z,b.p.z);assert.equal(b.s.vehicle.yaw,0);assert.equal(b.p.yaw,1.7);
 b.p.yaw=-2.4;step(a,{forward:true});step(b,{forward:true});assert.equal(a.p.z,b.p.z);assert.equal(a.p.x,b.p.x);
});
test('steering requires motion; left/right make mirrored arcs without strafing',async()=>{
 const a=await setup(),b=await setup();step(a,{left:true});assert.equal(a.s.vehicle.yaw,0);assert.equal(a.p.x,0);
 step(a,{forward:true,left:true});step(b,{forward:true,right:true});assert.ok(a.p.x<0);assert.ok(b.p.x>0);
 assert.ok(Math.abs(a.p.x+b.p.x)<1e-8);assert.ok(Math.abs(a.p.z-b.p.z)<1e-8);
});
test('reverse reverses steering yaw, brake stops without rotating the camera',async()=>{
 const a=await setup();a.p.yaw=.7;step(a,{backward:true,left:true});assert.ok(a.s.vehicle.yaw<0);assert.ok(a.p.z>190);
 step(a,{lift:true},120);assert.equal(Math.hypot(a.p.vx,a.p.vz),0);assert.equal(a.p.yaw,.7);
});
