import test from 'node:test';
import assert from 'node:assert/strict';
import {ROCK_FIELD,PROP_SOLIDS,WORLD,terrainHeight,supportHeight,rockSurfaceHeight,collidesAtHeight} from '../src/layout.mjs';
import {createMobility,stepMobility,parkedVehicleSurfaceHeight} from '../src/mobility.mjs';
import {createPlayer} from '../src/movement.mjs';

const rock=ROCK_FIELD.rocks.find(r=>r.x===24&&r.z===130);
function edgePoint(){
  for(let angle=0;angle<Math.PI*2;angle+=.05)for(let distance=.5;distance<rock.radius+.4;distance+=.025){
    const x=rock.x+Math.cos(angle)*distance,z=rock.z+Math.sin(angle)*distance;
    if(Number.isFinite(rockSurfaceHeight(rock,x,z)))continue;
    let oldFloor=terrainHeight(x,z);for(let i=0;i<8;i++)oldFloor=Math.max(oldFloor,rockSurfaceHeight(rock,x+Math.cos(i*Math.PI/4)*WORLD.radius,z+Math.sin(i*Math.PI/4)*WORLD.radius));
    if(oldFloor>terrainHeight(x,z)+.4)return {x,z,oldFloor};
  }
  throw new Error('Real boulder exterior fixture missing');
}
const edge=edgePoint();
test('a capsule beside a real mesh cannot use its lateral intersection as a foot platform',()=>{
  assert.equal(rockSurfaceHeight(rock,edge.x,edge.z),-Infinity);
  assert.equal(supportHeight(edge.x,edge.z,WORLD.radius),terrainHeight(edge.x,edge.z));
  assert.ok(edge.oldFloor>supportHeight(edge.x,edge.z)+.4);
});
test('an old hovering position beside a rock falls under gravity and lands without thrust energy',()=>{
  const state=createMobility(),p={...createPlayer(),x:edge.x,z:edge.z,y:edge.oldFloor};
  stepMobility(p,state,{},1/60);assert.equal(state.jump.airborne,true);
  const initialY=p.y;for(let i=0;i<120;i++)stepMobility(p,state,{},1/60);
  assert.ok(p.y<initialY-.4);assert.equal(p.y,terrainHeight(p.x,p.z));
  assert.equal(state.jump.airborne,false);assert.equal(state.flight.energy,100);
});
test('actual rock top remains a valid landing and jump surface',()=>{
  const state=createMobility(),top=rockSurfaceHeight(rock,rock.x,rock.z),p={...createPlayer(),x:rock.x,z:rock.z,y:top+1};
  state.jump.airborne=true;
  for(let i=0;i<120;i++)stepMobility(p,state,{},1/60);
  assert.equal(p.y,top);assert.equal(state.jump.airborne,false);
  stepMobility(p,state,{jump:true},1/60);assert.equal(state.jump.airborne,true);assert.ok(p.y>top);
});
test('prop side clearance is solid but does not extend its visible top platform',()=>{
  const box=PROP_SOLIDS.find(b=>b.x===12&&b.z===-330),x=box.x+box.w/2+.2,z=box.z,ground=terrainHeight(x,z);
  assert.equal(supportHeight(x,z,WORLD.radius),ground);
  assert.equal(collidesAtHeight(x,z,ground),true);
});
test('a surface above the previous feet height is never a landing target',()=>{
  const ground=terrainHeight(rock.x,rock.z),top=rockSurfaceHeight(rock,rock.x,rock.z);
  assert.ok(top>ground+.5);
  assert.equal(supportHeight(rock.x,rock.z,0,ground+.1),ground);
});
test('vehicle side clearance contains no invisible circular roof',()=>{
  const state=createMobility(),v=state.vehicle,x=v.x+1.1,z=v.z;
  assert.equal(parkedVehicleSurfaceHeight(x,z,v),-Infinity);
  const p={...createPlayer(),x,z,y:terrainHeight(x,z)+1.3};
  for(let i=0;i<120;i++)stepMobility(p,state,{},1/60);
  assert.equal(p.y,terrainHeight(x,z));
  assert.ok(parkedVehicleSurfaceHeight(v.x,v.z,v)<terrainHeight(v.x,v.z)+1.1);
});
