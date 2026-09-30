import test from 'node:test';
import assert from 'node:assert/strict';
import {createExpeditionRuntime} from '../src/expedition-runtime/index.mjs';
import {definitions} from '../src/expedition-world/definitions.mjs';
import {createWorldQueries} from '../src/expedition-world/queries.mjs';

async function setup({real=false,mounted=false}={}) {
  let saved=null,serial=0;
  const world={...definitions,resources:[],sites:[definitions.sites[0]],enemies:[definitions.enemies[0]]};
  const context={playing:true,menu:false,mounted,airborne:false,dashing:false,player:{x:0,z:190,y:0,yaw:0,pitch:0}};
  const storage={load:async()=>structuredClone(saved),initialize:async value=>{saved=structuredClone(value);},close(){},
    compareAndSwap:async({expectedRevision,nextState})=>{if(saved.revision!==expectedRevision)return false;saved=structuredClone(nextState);return true;}};
  const queries=real?{...createWorldQueries(),dynamicBlocked:()=>false}:{terrainHeight:()=>0,canOccupy:()=>true,canTraverse:()=>true,hasLineOfSight:()=>true,dynamicBlocked:()=>false};
  const runtime=await createExpeditionRuntime({link:{worldId:'independent-territory',playerId:'player'},world,queries,getContext:()=>context,openStorage:async()=>storage,makeId:()=>`audit-${++serial}`,isVisible:()=>false});
  async function advance(seconds){for(let i=0;i<Math.ceil(seconds*20);i++){runtime.tick(.05);while(runtime.busy)await new Promise(resolve=>setImmediate(resolve));assert.equal(runtime.view().error,'');}}
  await advance(.1);
  assert.equal(runtime.view().enemies.length,1);
  return {runtime,context,advance,home:world.enemies[0].home};
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

for(const real of [false,true])test(`real runtime distant creature patrols through checkpoints (${real?'real terrain':'flat control'})`,async()=>{
  const t=await setup({real});const start={...t.runtime.view().enemies[0]};let travel=0,last=start;const phases=new Set();
  for(let i=0;i<30;i++){await t.advance(.5);const next=t.runtime.view().enemies[0];travel+=distance(last,next);last=next;phases.add(next.behavior);assert.ok(distance(next,t.home)<65);}
  assert.ok(travel>5,`travel ${travel}`);assert.ok(phases.has('patrol'));assert.ok(t.runtime.snapshot().revision>3);t.runtime.destroy();
});
test('real runtime mounted player does not freeze autonomous patrol',async()=>{
  const t=await setup({mounted:true});const first={...t.runtime.view().enemies[0]};await t.advance(8);
  assert.ok(distance(first,t.runtime.view().enemies[0])>3);assert.equal(t.runtime.view().player.hp,120);t.runtime.destroy();
});
test('real runtime territorial chase disengages then returns home before patrol resumes',async()=>{
  const t=await setup();Object.assign(t.context.player,{x:t.home.x+28,z:t.home.z});await t.advance(1.5);
  assert.equal(t.runtime.view().enemies[0].behavior,'chase');const far=distance(t.runtime.view().enemies[0],t.home);assert.ok(far>3);
  Object.assign(t.context.player,{x:t.home.x+90,z:t.home.z});await t.advance(.1);assert.equal(t.runtime.view().enemies[0].behavior,'return');
  let closest=Infinity;for(let i=0;i<160;i++){await t.advance(.05);closest=Math.min(closest,distance(t.runtime.view().enemies[0],t.home));}
  assert.ok(closest<.4,`closest return ${closest}`);assert.equal(t.runtime.view().player.hp,120);t.runtime.destroy();
});
test('real runtime never attacks protected camp and suspends simulation in menu',async()=>{
  const t=await setup();await t.advance(12);assert.equal(t.runtime.view().player.hp,120);
  t.context.menu=true;const before=t.runtime.view();await t.advance(3);const after=t.runtime.view();assert.equal(after.time,before.time);assert.deepEqual(after.enemies,before.enemies);t.runtime.destroy();
});
test('returning creature passes a nearby unmounted player without beginning an attack',async()=>{
  const t=await setup();Object.assign(t.context.player,{x:t.home.x+28,z:t.home.z});await t.advance(1.5);
  t.context.mounted=true;await t.advance(.1);assert.equal(t.runtime.view().enemies[0].behavior,'return');
  t.context.mounted=false;
  for(let i=0;i<12;i++){
    const enemy=t.runtime.view().enemies[0];Object.assign(t.context.player,{x:enemy.x-.5,z:enemy.z});await t.advance(.05);
    assert.equal(t.runtime.view().enemies[0].behavior,'return');assert.notEqual(t.runtime.view().enemies[0].phase,'windup');
  }
  assert.equal(t.runtime.snapshot().combat.casts.length,0);t.runtime.destroy();
});
test('a creature killed through committed real combat stops moving and leaves loot',async()=>{
  const t=await setup();
  for(let attack=0;attack<4&&t.runtime.view().enemies[0].alive;attack++){
    const enemy=t.runtime.view().enemies[0];Object.assign(t.context.player,{x:enemy.x,z:enemy.z+1,yaw:0});
    await t.runtime.action({type:'attack'});await t.advance(1.1);
  }
  const corpse=t.runtime.view().enemies[0];assert.equal(corpse.alive,false);assert.equal(corpse.phase,'dead');
  await t.advance(5);const after=t.runtime.view().enemies[0];assert.equal(after.x,corpse.x);assert.equal(after.z,corpse.z);assert.ok(t.runtime.view().drops.some(d=>d.remaining>0));t.runtime.destroy();
});
