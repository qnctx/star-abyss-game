const test = require('node:test');
const assert = require('node:assert/strict');
const modules = Promise.all([import('../src/movement.mjs'), import('../src/layout.mjs')]);
async function setup() { const [motion,layout] = await modules; return { ...motion, ...layout }; }
function walk(m, p, x, z, gateOpen=false) {
  for (let i=0;i<12000&&Math.hypot(x-p.x,z-p.z)>.12;i++) { p.heading=Math.atan2(p.x-x,p.z-z);m.movePlayer(p,{forward:true,sprint:true},1/60,gateOpen); }
  p.vx=0;p.vz=0;return Math.hypot(x-p.x,z-p.z);
}
test('W/S and A/D change real player coordinates in body-relative directions',async()=>{
  const m=await setup();
  for (const [input,axis,sign] of [[{forward:true},'z',-1],[{backward:true},'z',1],[{left:true},'x',-1],[{right:true},'x',1]]) {
    const p=m.createPlayer(),start=p[axis];for(let i=0;i<60;i++)m.movePlayer(p,input,1/60);assert.ok((p[axis]-start)*sign>(input.forward?4:1.9));
  }
  const p=m.createPlayer();p.heading=Math.PI/2;for(let i=0;i<60;i++)m.movePlayer(p,{forward:true},1/60);assert.ok(p.x<-4);assert.equal(p.z,190);
});
test('independent free-look yaw and pitch cannot steer movement, including diagonals',async()=>{
  const m=await setup();
  for(const input of [{forward:true},{backward:true},{left:true},{right:true},{forward:true,right:true}]){
    const fixed=m.createPlayer(),looking=m.createPlayer();fixed.heading=looking.heading=.7;
    for(let i=0;i<90;i++){
      looking.yaw=i*.3;looking.pitch=Math.sin(i*.1);
      m.movePlayer(fixed,input,1/60,false,{collides:()=>false});m.movePlayer(looking,input,1/60,false,{collides:()=>false});
    }
    assert.equal(looking.x,fixed.x);assert.equal(looking.z,fixed.z);assert.equal(looking.heading,.7);
  }
});
test('keyboard turn changes physical forward, preserves look offset and never turns a mounted vehicle',async()=>{
  const m=await setup(),p=m.createPlayer();p.yaw=.6;
  for(let i=0;i<60;i++)m.turnPlayerHeading(p,{turnLeft:true},1/60);
  assert.ok(Math.abs(p.heading-1.65)<1e-10);assert.ok(Math.abs(p.yaw-p.heading-.6)<1e-10);
  const before={...p};m.turnPlayerHeading(p,{turnRight:true},.05,{mounted:true});assert.deepEqual(p,before);
  m.turnPlayerHeading(p,{turnLeft:true,turnRight:true},.05);assert.deepEqual(p,before);
  m.turnPlayerHeading(p,{turnRight:true},.05);assert.ok(p.heading<before.heading);
  for(let i=0;i<60;i++)m.movePlayer(p,{forward:true},1/60,false,{collides:()=>false});assert.ok(p.x<-4);
});
test('heading restoration retains independent look and migrates old saves',async()=>{
  const m=await setup();
  assert.equal(m.restorePlayer({x:0,z:190,yaw:1.2}).heading,1.2);
  const p=m.restorePlayer({x:0,z:190,yaw:2.2,heading:.4});assert.equal(p.heading,.4);assert.equal(p.yaw,2.2);
  assert.equal(m.restorePlayer({x:0,z:190,yaw:.8,heading:NaN}).heading,.8);
  const legacy={x:0,z:190,yaw:Math.PI/2,vx:0,vz:0};
  for(let i=0;i<60;i++)m.movePlayer(legacy,{forward:true},1/60);assert.ok(legacy.x<-4);
});
test('diagonal input is normalized with a blended walking cap and forward run remains faster',async()=>{
  const m=await setup(); const distances=[];
  for(const input of [{forward:true},{forward:true,right:true},{forward:true,sprint:true}]){const p=m.createPlayer();for(let i=0;i<60;i++)m.movePlayer(p,input,1/60);distances.push(Math.hypot(p.x,p.z-190));}
  assert.ok(Math.abs(distances[1]/distances[0]-3.55/4.7)<.001);assert.ok(distances[2]>distances[0]*1.7);
});
test('flat-route eye height never oscillates with footsteps or stop',async()=>{
  const m=await setup(),p=m.createPlayer(),startZ=p.z;for(let i=0;i<300;i++){m.movePlayer(p,{forward:i<200,sprint:true},1/60);assert.equal(m.eyePosition(p).y,1.72);}assert.ok(startZ-p.z>20);assert.ok(Math.abs(p.vz)<.001);
});
test('held slow walking preserves default pace, diagonal normalization and overrides sprint',async()=>{
  const m=await setup();
  for(const direction of [{forward:true},{backward:true},{left:true},{right:true},{forward:true,right:true}]){
    for(const [walk,sprint] of [[false,false],[true,false],[true,true]]){
      const forward=Number(!!direction.forward)-Number(!!direction.backward),side=Number(!!direction.right)-Number(!!direction.left);
      const front=walk?1.65:4.7,back=walk?1.2:2.2,lateral=walk?1.3:2.4;
      const expected=sprint&&!walk&&forward>0?8.6:lateral+((forward<0?back:front)-lateral)*forward*forward/(forward*forward+side*side);
      const p=m.createPlayer();
      // Isolate pace selection from unrelated rocks in each direction;
      // obstacle and real-route collision behavior is covered below.
      for(let i=0;i<120;i++)m.movePlayer(p,{...direction,walk,sprint},1/60,false,{collides:()=>false});
      assert.ok(Math.abs(Math.hypot(p.vx,p.vz)-expected)<.001,JSON.stringify({direction,walk,sprint,expected}));
      assert.equal(m.eyePosition(p).y,1.72);
    }
  }
});
test('explicit flight or vehicle speeds override a retained walking preference',async()=>{
  const m=await setup();
  for(const speed of [12,24,32]){
    const p=m.createPlayer();
    for(let i=0;i<120;i++)m.movePlayer(p,{forward:true,walk:true},1/60,false,{speed,collides:()=>false});
    assert.ok(Math.abs(Math.hypot(p.vx,p.vz)-speed)<.001);
  }
});
test('lateral and backward sprint requests cannot bypass their pace caps or report sprint credit',async()=>{
  const m=await setup();
  for(const [direction,expected] of [[{left:true},2.4],[{right:true},2.4],[{backward:true},2.2],[{backward:true,right:true},2.3],[{forward:true,right:true},8.6]]){
    const p=m.createPlayer();let motion;
    for(let i=0;i<120;i++)motion=m.movePlayer(p,{...direction,sprint:true},1/60,false,{collides:()=>false});
    assert.ok(Math.abs(Math.hypot(p.vx,p.vz)-expected)<.001);assert.equal(motion.sprinting,!!direction.forward);
  }
});
test('directional pace blend is continuous and explicit movement speeds bypass all walking caps',async()=>{
  const m=await setup();let previous=2.4;
  for(let i=0;i<=20;i++){
    const p=m.createPlayer(),forward=i/20;
    for(let frame=0;frame<120;frame++)m.movePlayer(p,{forward,right:true},1/60,false,{collides:()=>false});
    const speed=Math.hypot(p.vx,p.vz);assert.ok(speed>=previous-.00001&&speed-previous<.08);previous=speed;
  }
  for(const direction of [{left:true},{backward:true},{backward:true,right:true}]){
    const p=m.createPlayer();
    for(let i=0;i<120;i++)m.movePlayer(p,{...direction,walk:true,sprint:true},1/60,false,{speed:24,collides:()=>false});
    assert.ok(Math.abs(Math.hypot(p.vx,p.vz)-24)<.001);
  }
});
test('large real map and continuous spawn → breach → cargo → relay → seal path',async()=>{
  const m=await setup(),p=m.createPlayer();assert.equal(m.WORLD.halfSize*2,6000);
  for(const [x,z] of [[0,-465],[0,-530],[-27,-542],[-16,-544],[0,-544],[0,-590],[0,-635],[24,-633],[26,-642],[0,-635],[0,-706]]) assert.ok(walk(m,p,x,z)<.15,`route blocked toward ${x},${z}, got ${p.x},${p.z}`);
  assert.ok(m.insideWreck(p.x,p.z));for(let i=0;i<120;i++)m.movePlayer(p,{forward:true},1/60,false);assert.ok(p.z>-711);
  assert.ok(walk(m,p,0,-764,true)<.15);
});
test('walls, map limits and sealed-room save positions are enforced',async()=>{
  const m=await setup();assert.ok(m.collides(-49,-620));assert.ok(m.collides(3000,0));assert.ok(!m.collides(0,-470));
  assert.deepEqual(m.restorePlayer({x:Infinity,z:0}),m.createPlayer());assert.deepEqual(m.restorePlayer({x:0,z:-764},false),m.createPlayer());assert.equal(m.restorePlayer({x:0,z:-764},true).z,-764);
  assert.equal(m.hasLineOfSight({x:0,z:-707},{x:0,z:-716},false),false);assert.equal(m.hasLineOfSight({x:0,z:-707},{x:0,z:-716},true),true);
});
