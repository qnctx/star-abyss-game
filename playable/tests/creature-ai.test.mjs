import test from 'node:test';
import assert from 'node:assert/strict';
import {steerCreature,turnToward,canBeginCreatureAttack} from '../src/expedition-runtime/creature-ai.mjs';

const def={home:{x:0,z:0},perceptionRadius:35,territoryRadius:65,moveSpeed:7.8};
function step(overrides={}){
  return steerCreature({enemy:{x:0,z:0,yaw:Math.PI},player:{x:0,z:15},def,now:1,dt:.05,enabled:true,
    clear:()=>true,visible:()=>true,protectedPoint:()=>false,hp:96,...overrides});
}
test('unobstructed tracking follows lateral target changes without cached goal delay',()=>{
  const enemy={x:0,z:0,yaw:Math.PI};let {memory}=step({enemy});
  const oldX=enemy.x;step({enemy,memory,now:1.05,player:{x:1,z:15}});assert.ok(enemy.x>oldX);
});
test('vision blocked beyond hearing distance does not acquire through rock',()=>{
  const enemy={x:0,z:0,yaw:0};const r=step({enemy,visible:()=>false});
  assert.equal(r.pursuing,false);assert.equal(enemy.z,0);
});
test('losing sight pursues last seen position, then forgets after three seconds',()=>{
  const {memory}=step();const hidden={player:{x:20,z:20},visible:()=>false,memory};
  assert.equal(step({...hidden,now:2}).pursuing,true);assert.deepEqual(memory.lastSeen,{x:0,z:15});
  assert.equal(step({...hidden,now:4.1}).pursuing,false);
});
test('nearby sound or damage alerts but protected camp and territory stay safe',()=>{
  assert.equal(step({player:{x:0,z:5},visible:()=>false}).detected,true);
  assert.equal(step({memory:{hp:96},hp:63,visible:()=>false}).detected,true);
  assert.equal(step({protectedPoint:()=>true}).pursuing,false);
  assert.equal(step({player:{x:0,z:70},memory:{hp:96},hp:63}).pursuing,false);
});
test('turn speed is bounded and shortest across angle wrap',()=>{
  assert.ok(Math.abs(turnToward(0,Math.PI,.05))<=.2750001);
  assert.ok(Math.abs(turnToward(Math.PI-.05,-Math.PI+.05,.05)+Math.PI-.05)<1e-6);
});
test('attack requires facing, distance and sight, allowing sidestep during fixed windup',()=>{
  const e={x:0,z:0,yaw:0};assert.equal(canBeginCreatureAttack(e,{x:0,z:-2},2.5,()=>true),true);
  assert.equal(canBeginCreatureAttack(e,{x:0,z:2},2.5,()=>true),false);
  assert.equal(canBeginCreatureAttack(e,{x:0,z:-2},2.5,()=>false),false);
  assert.equal(canBeginCreatureAttack(e,{x:0,z:-3},2.5,()=>true),false);
});
test('blocked movement never tunnels and replans when movable obstruction clears',()=>{
  const enemy={x:0,z:0,yaw:Math.PI};const {memory}=step({enemy,clear:()=>false});
  assert.equal(enemy.z,0);assert.equal(memory.lastMoved,undefined);
  step({enemy,memory,now:1.05});assert.ok(enemy.z>0);assert.equal(memory.lastMoved,1.05);
});
test('local path goes around solid rock with each motion segment checked',()=>{
  const enemy={x:0,z:0,yaw:Math.PI},player={x:0,z:12};let memory;
  const clear=(a,b)=>{for(let i=0;i<=30;i++){const t=i/30,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;if(Math.abs(x)<2&&z>3&&z<7)return false;}return true;};
  for(let i=0;i<180;i++){
    const before={...enemy};({memory}=step({enemy,player,memory,clear,now:i*.05}));assert.ok(clear(before,enemy));
  }
  assert.ok(Math.hypot(enemy.x-player.x,enemy.z-player.z)<2);
});
test('arrival stops movement indication instead of animating chase forever away from home',()=>{
  const enemy={x:0,z:13.5,yaw:Math.PI};const {memory}=step({enemy,memory:{lastMoved:0}});
  assert.equal(memory.lastMoved,0);assert.equal(enemy.z,13.5);
});
