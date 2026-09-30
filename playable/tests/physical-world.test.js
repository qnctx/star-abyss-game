const test=require('node:test');
const assert=require('node:assert/strict');
const modules=Promise.all([import('../src/layout.mjs'),import('../src/movement.mjs'),import('../src/rocks.mjs'),import('../src/camera.mjs')]);
const setup=async()=>Object.assign({},...await modules);

test('rock field is deterministic and collision queries are local',async()=>{
  const m=await setup(),again=m.createRockField(m.POINTS);
  assert.deepEqual(again.rocks,m.ROCK_FIELD.rocks);
  assert.ok(again.rocks.length>3000);
  assert.ok(again.query(24,130,1).length<60);
  assert.ok(again.query(24,130,1).some(r=>r.x===24&&r.z===130&&r.solid));
  assert.equal(again.query(2900,2900,1).length,0);
});

test('boulders have visible convex-footprint collision while small gravel stays walkable',async()=>{
  const m=await setup(),rock=m.ROCK_FIELD.rocks.find(r=>r.x===24&&r.z===130);
  assert.ok(m.collides(rock.x,rock.z));
  assert.equal(m.touchesRock(rock,rock.x+rock.radius+.5,rock.z,.42),false);
  const pebble=m.ROCK_FIELD.rocks.find(r=>!r.solid&&!m.collides(r.x,r.z));
  assert.equal(m.surfaceAt(pebble.x,pebble.z),'rock');
  assert.equal(m.surfaceAt(0,-500),'metal');
  assert.equal(m.collides(pebble.x,pebble.z),false);
  for(let z=220;z>-458;z-=2)assert.equal(m.ROCK_FIELD.query(0,z,.42).some(r=>r.solid&&m.touchesRock(r,0,z,.42)),false);
});

test('walking into a boulder stops and reports contact without shaking eye height',async()=>{
  const m=await setup(),p=m.createPlayer();p.x=24;p.z=134;p.yaw=0;
  let blocked=false;
  for(let i=0;i<180;i++) {
    const motion=m.movePlayer(p,{forward:true,sprint:true},1/60);
    blocked ||= motion.blocked;
    assert.equal(m.eyePosition(p).y,1.72);
    assert.equal(m.collides(p.x,p.z),false);
  }
  assert.ok(blocked);assert.ok(p.z>130);assert.ok(p.z<133);
  for(let i=0;i<120;i++)m.movePlayer(p,{forward:true,right:true},1/60);
  assert.ok(p.x>28,'diagonal input should slide along and around the rock');
});

test('first-person camera keeps exact eye position; third-person never changes player coordinates',async()=>{
  const m=await setup(),p=m.createPlayer(),before={...p};
  const first=m.resolveCamera(p,'first');assert.deepEqual(first.position,m.eyePosition(p));assert.equal(first.avatarVisible,false);
  const third=m.resolveCamera(p,'third');assert.equal(third.mode,'third');assert.ok(third.distance>4);assert.ok(third.avatarVisible);
  assert.ok(third.position.z>p.z);assert.equal(m.cameraBlocked(third.position),false);assert.deepEqual(p,before);
  const again=m.resolveCamera(p,'first',third);assert.deepEqual(again.position,first.position);
});

test('full-circle free look keeps body heading fixed and every camera angle remains physically valid',async()=>{
  const m=await setup();
  for(const location of [{x:0,z:190},{x:6.4,z:-541},{x:0,z:-709}]) {
    const p={...m.createPlayer(),...location,heading:.45};
    for(const mode of ['first','third','vehicle']) {
      for(let i=0;i<16;i++) {
        p.yaw=i*Math.PI/8;p.pitch=[-.65,0,.65][i%3];
        const before={...p},camera=m.resolveCamera(p,mode);
        assert.deepEqual(p,before,'orbiting must not mutate the player body');
        assert.equal(p.heading,.45);
        assert.ok(Object.values(camera.position).every(Number.isFinite));
        if(mode!=='first')assert.equal(m.cameraBlocked(camera.position),false,`${mode} angle ${i} at ${location.x},${location.z}`);
      }
    }
  }
});

test('third-person boom shortens indoors and cannot penetrate walls, sealed doors, rocks or terrain',async()=>{
  const m=await setup();
  const outdoor=m.resolveCamera({...m.createPlayer(),pitch:0},'third');
  const indoor=m.resolveCamera({x:0,z:-540,yaw:0,pitch:0},'third');
  assert.ok(indoor.distance<outdoor.distance);
  const byWall=m.resolveCamera({x:6.4,z:-541,yaw:Math.PI/2,pitch:0},'third');
  assert.ok(byWall.occluded);assert.ok(byWall.position.x<6.8);assert.equal(m.cameraBlocked(byWall.position),false);
  const door=m.resolveCamera({x:0,z:-709,yaw:Math.PI,pitch:0},'third');
  assert.ok(door.occluded);assert.ok(door.position.z>-710.1);assert.equal(m.cameraBlocked(door.position),false);
  const open=m.resolveCamera({x:0,z:-709,yaw:Math.PI,pitch:0},'third',null,1/60,true);assert.ok(open.distance>door.distance);
  const ground=m.resolveCamera({...m.createPlayer(),pitch:1.2},'third');assert.ok(ground.occluded);assert.equal(m.cameraBlocked(ground.position),false);
  const boulder=m.resolveCamera({x:-25,z:48,yaw:Math.PI,pitch:0},'third');assert.ok(boulder.occluded);assert.equal(m.cameraBlocked(boulder.position),false);
});

test('camera smoothing stays collision-safe through turns and new games',async()=>{
  const m=await setup(),p={x:6.4,z:-541,yaw:-Math.PI/2,pitch:0};
  let state=m.resolveCamera(p,'third');p.yaw=Math.PI/2;
  for(let i=0;i<60;i++) {state=m.resolveCamera(p,'third',state,1/60);assert.equal(m.cameraBlocked(state.position),false);}
  const reset=m.resolveCamera(m.createPlayer(),'third',state,1/60);
  assert.ok(Math.hypot(reset.position.x,reset.position.z-190)<5,'teleport/save restore must not drag the camera across the map');
});
