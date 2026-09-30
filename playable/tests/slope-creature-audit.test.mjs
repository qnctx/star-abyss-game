import test from 'node:test';
import assert from 'node:assert/strict';
import {combatBody,canHit} from '../src/expedition-runtime/rules.mjs';
import {canBeginCreatureAttack} from '../src/expedition-runtime/creature-ai.mjs';
import {createWorldQueries} from '../src/expedition-world/queries.mjs';
import {configureWorldExtension,terrainHeight} from '../src/layout.mjs';

const visible=()=>true;
test('combat preserves player platform height, with terrain fallback for legacy enemies',()=>{
  const ground=()=>30;
  const enemy=combatBody({x:0,z:0,yaw:0},ground);
  const player=combatBody({x:0,z:-1,y:33},ground);
  assert.equal(enemy.y,31);assert.equal(player.y,34);
  assert.equal(canBeginCreatureAttack(enemy,player,2.5,visible),false);
  assert.equal(canHit(enemy,player,0,2.5,visible),false);
  assert.equal(canHit(player,enemy,Math.PI,4.2,visible),false);
});
test('diagonal vertical separation consumes attack reach rather than planar reach alone',()=>{
  const enemy={x:0,z:0,y:1,yaw:0},player={x:0,z:-2.3,y:2.2};
  assert.equal(canBeginCreatureAttack(enemy,player,2.5,visible),false);
  assert.equal(canHit(enemy,player,0,2.5,visible),false);
  player.z=-1.5;
  assert.equal(canBeginCreatureAttack(enemy,player,2.5,visible),true);
  assert.equal(canHit(enemy,player,0,2.5,visible),true);
});
test('legacy callers without y retain attacks and opaque terrain still blocks sight',()=>{
  const enemy={x:0,z:0,yaw:0},player={x:0,z:-2};
  assert.equal(canBeginCreatureAttack(enemy,player,2.5,visible),true);
  assert.equal(canHit(enemy,player,0,2.5,visible),true);
  assert.equal(canHit({...enemy,y:1},{...player,y:1},0,2.5,()=>false),false);
});
function withSlope(slope,run){
  configureWorldExtension({height:(x,z)=>slope*(x-3500),blocked:()=>false,surface:()=> 'rock'});
  try{run(createWorldQueries());}finally{configureWorldExtension(null);}
}
test('creature traversal rejects steep ascent and descent at both tiny and long steps',()=>{
  withSlope(1.5,q=>{
    for(const length of [.001,.065,.1,.19,.2,.39,1,5]){
      const a={x:3500,z:0},b={x:3500+length,z:0};
      assert.equal(q.canTraverse(a,b),false,`ascent ${length}`);
      assert.equal(q.canTraverse(b,a),false,`descent ${length}`);
    }
  });
});
test('walkable 26.6 degree slope remains traversable and support matches the shared surface',()=>{
  withSlope(.5,q=>{
    for(const length of [.001,.065,.1,.39,1,5]){
      const a={x:3500,z:0},b={x:3500+length,z:0};
      assert.equal(q.canTraverse(a,b),true);
      assert.equal(q.canTraverse(b,a),true);
      assert.equal(q.terrainHeight(b.x,b.z),terrainHeight(b.x,b.z));
      assert.ok(Math.abs(q.terrainHeight(b.x,b.z)-length*.5)<1e-9);
    }
  });
});
test('missing terrain cannot provide creature support',()=>{
  withSlope(NaN,q=>{
    assert.equal(q.canOccupy({x:3500,z:0}),false);
    assert.equal(q.canTraverse({x:3500,z:0},{x:3500.1,z:0}),false);
  });
});
