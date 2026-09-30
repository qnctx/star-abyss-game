const {test,before}=require('node:test');
const assert=require('node:assert/strict');
let m,l;before(async()=>{m=await import('../src/movement.mjs');l=await import('../src/look-control.mjs');});
test('dismount clears stale Alt return and immediately steers the body without Alt',()=>{
 const p=m.createPlayer(),s=l.createLookControl();p.yaw=1.4;p.heading=-.8;s.free=true;s.returning=true;
 l.leaveVehicleLook(s,p);assert.equal(s.free,false);assert.equal(s.returning,false);assert.equal(p.heading,p.yaw);
 const before=p.heading;l.applyMouseLook(s,p,100,0);assert.ok(Math.abs(p.heading-before)>.2);assert.equal(p.heading,p.yaw);
});
test('ordinary mouse steers a continuous sprint while Alt look preserves the route',()=>{
  const a=m.createPlayer(),b=m.createPlayer(),s=l.createLookControl();
  for(let i=0;i<60;i++)m.movePlayer(a,{forward:true,sprint:true},1/60,false,{collides:()=>false});
  l.applyMouseLook(s,a,Math.PI/2/.0022,0);
  for(let i=0;i<60;i++)m.movePlayer(a,{forward:true,sprint:true},1/60,false,{collides:()=>false});
  assert.ok(a.x>7);assert.ok(Math.abs(a.heading+Math.PI/2)<1e-10);
  const t=l.createLookControl();l.setFreeLook(t,b,true);const expected=m.createPlayer();
  for(let i=0;i<90;i++){
    l.applyMouseLook(t,b,7,2);m.movePlayer(b,{forward:true,sprint:true},1/60,false,{collides:()=>false});
    m.movePlayer(expected,{forward:true,sprint:true},1/60,false,{collides:()=>false});
  }
  assert.equal(b.heading,0);assert.equal(b.x,expected.x);assert.equal(b.z,expected.z);assert.notEqual(b.yaw,0);
});
test('release returns camera by shortest arc without rotating body; frame partitions agree',()=>{
  const p=m.createPlayer(),s=l.createLookControl();p.heading=p.yaw=3.12;p.pitch=.2;
  l.setFreeLook(s,p,true);l.applyMouseLook(s,p,-120,-100);l.setFreeLook(s,p,false);
  const q={...p},t={...s},initial=Math.abs(Math.atan2(Math.sin(p.yaw-p.heading),Math.cos(p.yaw-p.heading)));
  l.updateLookControl(s,p,1/60);const first=Math.abs(Math.atan2(Math.sin(p.yaw-p.heading),Math.cos(p.yaw-p.heading)));
  assert.ok(first>0&&first<initial);assert.equal(p.heading,3.12);
  for(let i=1;i<30;i++)l.updateLookControl(s,p,1/60);
  for(let i=0;i<60;i++)l.updateLookControl(t,q,1/120);
  assert.ok(Math.abs(p.yaw-q.yaw)<1e-10);
  for(let i=0;i<90;i++)l.updateLookControl(s,p,1/60);
  assert.equal(p.yaw,p.heading);assert.equal(p.pitch,.2);assert.equal(s.returning,false);
});
test('mouse during recenter only applies requested turn; vehicle mouse never steers',()=>{
  const p=m.createPlayer(),s=l.createLookControl();l.setFreeLook(s,p,true);l.applyMouseLook(s,p,500,20);l.setFreeLook(s,p,false);
  l.applyMouseLook(s,p,10,-5);assert.ok(Math.abs(p.heading+.022)<1e-10);
  const heading=p.heading;l.applyMouseLook(s,p,300,0,{mounted:true});assert.equal(p.heading,heading);
  l.updateLookControl(s,p,.05,{mounted:true});assert.equal(s.returning,false);
});
