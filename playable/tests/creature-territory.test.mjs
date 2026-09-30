import test from 'node:test';
import assert from 'node:assert/strict';
import {steerCreature} from '../src/expedition-runtime/creature-ai.mjs';

const def={home:{x:0,z:0},perceptionRadius:35,territoryRadius:65,moveSpeed:7.8};
function simulation(options={}) {
  const enemy={x:0,z:0,yaw:0,...options.enemy};
  let memory={},now=0;
  const optionsForStep={player:{x:100,z:100},def,enabled:true,clear:()=>true,visible:()=>true,protectedPoint:()=>false,hp:96,...options};
  return {enemy,get memory(){return memory;},step(dt=.05,overrides={}){
    now+=dt;const result=steerCreature({...optionsForStep,...overrides,enemy,memory,now,dt});memory=result.memory;return result;
  }};
}
test('unobserved creatures patrol repeatedly and pause briefly to watch instead of waiting at home',()=>{
  const sim=simulation(),states=new Set();let distance=0,watches=0,previous='';
  for(let i=0;i<1200;i++){
    const before={...sim.enemy};const result=sim.step();states.add(result.behavior);
    distance+=Math.hypot(sim.enemy.x-before.x,sim.enemy.z-before.z);
    if(result.behavior==='watch'&&previous!=='watch')watches++;
    previous=result.behavior;
    assert.ok(Math.hypot(sim.enemy.x,sim.enemy.z)<def.territoryRadius);
  }
  assert.ok(distance>80);assert.ok(watches>=3);assert.deepEqual([...states].sort(),['patrol','watch']);
});
test('patrol is reproducible and different homes produce different routes',()=>{
  const a=simulation(),b=simulation(),c=simulation({def:{...def,home:{x:1,z:0}},enemy:{x:1}});
  for(let i=0;i<400;i++){a.step();b.step();c.step();}
  assert.deepEqual(a.enemy,b.enemy);assert.notDeepEqual({...c.enemy,x:c.enemy.x-1},a.enemy);
});
test('intruder interrupts a patrol immediately and pursuit returns home after territory exit',()=>{
  const sim=simulation();for(let i=0;i<80;i++)sim.step();
  assert.equal(sim.memory.behavior,'patrol');
  const player={x:sim.enemy.x+4,z:sim.enemy.z+4};
  assert.equal(sim.step(.05,{player}).behavior,'chase');
  assert.equal(sim.step(.05,{player:{x:100,z:100}}).behavior,'return');
  let returned=false;
  for(let i=0;i<1000;i++){
    const result=sim.step();if(result.behavior==='watch'){returned=true;assert.ok(Math.hypot(sim.enemy.x,sim.enemy.z)<.4);break;}
  }
  assert.ok(returned);
});
test('camp refuge ends pursuit and blocks reacquisition while returning',()=>{
  const sim=simulation({enemy:{x:15,z:0}});
  sim.step(.05,{player:{x:18,z:0}});
  assert.equal(sim.step(.05,{player:{x:19,z:0},protectedPoint:p=>p.x>18}).behavior,'return');
  assert.equal(sim.step(.05,{player:{x:15,z:0}}).pursuing,false);
});
test('disabled combat does not stop autonomous life',()=>{
  const sim=simulation({enabled:false,player:{x:2,z:2}});let travelled=0;
  for(let i=0;i<400;i++){
    const before={...sim.enemy},result=sim.step();assert.equal(result.pursuing,false);
    travelled+=Math.hypot(sim.enemy.x-before.x,sim.enemy.z-before.z);
  }
  assert.ok(travelled>20);
});
test('every patrol step respects terrain and protected areas, retries after obstruction clears',()=>{
  let blocked=true;
  const clear=(a,b)=>!blocked&&b.x<=3;
  const sim=simulation({clear,protectedPoint:p=>p.z>3});
  for(let i=0;i<200;i++)sim.step();
  assert.deepEqual(sim.enemy,{x:0,z:0,yaw:sim.enemy.yaw});blocked=false;
  for(let i=0;i<500;i++){const before={...sim.enemy};sim.step();assert.ok(clear(before,sim.enemy));assert.ok(sim.enemy.z<=3);}
  assert.ok(Math.hypot(sim.enemy.x,sim.enemy.z)>1);
});
test('same real time at 30/60/120 Hz produces comparable patrol displacement',()=>{
  const positions=[30,60,120].map(hz=>{const sim=simulation();for(let i=0;i<hz*6;i++)sim.step(1/hz);return sim.enemy;});
  for(const p of positions)assert.ok(Math.hypot(p.x-positions[1].x,p.z-positions[1].z)<.25);
});
test('a creature restored beyond its territory walks back instead of pursuing or teleporting',()=>{
  const sim=simulation({enemy:{x:70,z:0},player:{x:64,z:0}});
  const result=sim.step();assert.equal(result.behavior,'return');assert.equal(result.pursuing,false);
  assert.ok(sim.enemy.x<70&&sim.enemy.x>69);
});
