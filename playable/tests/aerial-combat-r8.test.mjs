import test from 'node:test';
import assert from 'node:assert/strict';
import {createExpeditionRuntime,sceneConfigFor} from '../src/expedition-runtime/index.mjs';
import {definitions} from '../src/expedition-world/definitions.mjs';
import {baseResource} from '../src/d3-combat/index.mjs';
import {airAttackForRealm,airTargets,rayContact,boltHitsAim} from '../src/expedition-runtime/aerial-combat.mjs';
import {validateScene} from '../src/d3-session/scene.mjs';
import {PACK} from '../src/expedition-runtime/rules.mjs';
import {emptySkills} from '../src/combat-skills/state.mjs';

async function fixture({realm=4,two=false,learned=false}={}){
  const site=definitions.sites[0],first=definitions.enemies[0];
  const enemies=two?[first,{...first,id:first.id+'-second',x:first.x+2,z:first.z}]:[first];
  const world={...definitions,sites:[site],resources:[],enemies};
  const context={playing:true,menu:false,skillMenu:false,remote:false,mounted:false,airborne:false,flying:false,combatZone:false,dashing:false,prone:false,
    player:{x:0,z:190,y:0,yaw:0,pitch:0}};
  let saved=null,serial=0,walkable=true;
  const storage={load:async()=>structuredClone(saved),initialize:async root=>{
    const next=structuredClone(root),actor=next.combat.actors.find(a=>a.id==='player');actor.realm=realm;actor.resource=baseResource(realm,actor.level);
    if(learned){next.combatSkills=emptySkills();next.combatSkills.learned.ES05={tier:1,mastery:1};next.combatSkills.slots.active[0]='ES05';}
    saved=next;
  },close(){},compareAndSwap:async({expectedRevision,nextState})=>{
    if(saved.revision!==expectedRevision)return false;saved=structuredClone(nextState);return true;
  }};
  const queries={terrainHeight:()=>0,canOccupy:()=>true,canTraverse:()=>walkable,hasLineOfSight:()=>true,dynamicBlocked:()=>false};
  const runtime=await createExpeditionRuntime({link:{worldId:'aerial-r8',playerId:'player'},world,queries,getContext:()=>context,
    openStorage:async()=>storage,makeId:()=>`aerial-${++serial}`,isVisible:()=>false});
  async function advance(seconds){for(let i=0;i<Math.ceil(seconds*20);i++){runtime.tick(.05);while(runtime.busy)await new Promise(resolve=>setImmediate(resolve));assert.equal(runtime.view().error,'');}}
  for(let i=0;i<50&&runtime.view().enemies.length<enemies.length;i++)await advance(.05);
  assert.equal(runtime.view().enemies.length,enemies.length);
  walkable=false;
  const target=runtime.view().enemies[0];
  Object.assign(context,{airborne:true,flying:true,combatZone:true});
  Object.assign(context.player,{x:target.x,z:target.z+10,y:8,yaw:0,pitch:-Math.atan2(8,10)});
  return {runtime,context,advance,storage,target,enemies};
}

test('3D aim is finite, altitude matters, and occlusion rejects even a geometrically aligned target',()=>{
  assert.ok(rayContact({x:0,y:10,z:0},{x:0,y:1,z:-10},0,-Math.atan2(9,10),32,.9)!==null);
  assert.equal(rayContact({x:0,y:10,z:0},{x:0,y:1,z:-10},0,0,32,.9),null);
  assert.equal(boltHitsAim({x:0,z:0},{x:0,y:9,z:-10},{x:0,y:10,z:-10},()=>0,()=>false),false);
  const attack=airAttackForRealm(8),body=p=>p;
  const targets=airTargets({from:{x:0,y:10,z:0},enemies:[['one',{x:0,y:1,z:-10}],['two',{x:1,y:1,z:-10}]],body,
    aim:{yaw:0,pitch:-Math.atan2(9,10),position:{x:0,y:1,z:-10}},attack,lineOfSight:()=>true});
  assert.deepEqual(targets.map(x=>x.id),['one','two']);
});

test('flight R commits a real 3D hit and defeat materializes durable ground loot',async()=>{
  const t=await fixture();
  assert.equal(t.runtime.view().skill.ready,true);
  for(let i=0;i<8&&t.runtime.view().enemies[0].alive;i++){
    assert.equal(await t.runtime.action({type:'attack'}),true,t.runtime.view().error);
    const cast=t.runtime.combatView().aerialCasts.find(c=>c.sourceId==='player');
    assert.equal(cast.kind,'air-blade');assert.equal(cast.realm,4);
    await t.advance(1.35);
  }
  const root=t.runtime.snapshot();
  assert.equal(t.runtime.view().enemies[0].alive,false);
  assert.ok(root.combat.hits.some(h=>h.targetId===t.target.instanceId));
  assert.equal(root.drops.filter(d=>d.created).length,1);
  assert.ok(t.runtime.view().drops[0].remaining>0);
  assert.equal(root.scene.player.y,8);
  assert.equal(validateScene(root.scene,root,sceneConfigFor('player')),true);
  const legacy=structuredClone(root);delete legacy.scene.player.y;
  assert.equal(validateScene(legacy.scene,legacy,sceneConfigFor('player')),true);
  const malformed=structuredClone(root);malformed.scene.player.y=Infinity;
  assert.throws(()=>validateScene(malformed.scene,malformed,sceneConfigFor('player')));
  t.context.flying=false;t.context.airborne=false;t.context.combatZone=false;t.context.player.y=0;
  Object.assign(t.context.player,{x:t.target.x,z:t.target.z+1});
  await t.runtime.action({type:'interact'});
  assert.ok(t.runtime.snapshot().inventory.items.some(i=>i.definitionId==='scavenger-blood'&&i.containerId===PACK));
  t.runtime.destroy();
});

test('telegraphed scavenger bolt can be dodged during windup and can damage a hovering player',async()=>{
  const t=await fixture();
  let bolt=null;
  for(let i=0;i<50&&!bolt;i++){
    await t.advance(.05);bolt=t.runtime.combatView().aerialCasts.find(c=>c.kind==='scavenger-bolt');
  }
  assert.ok(bolt,'ground enemy should commit a real ranged cast');
  const hp=t.runtime.view().player.hp;
  t.context.player.x+=4;
  await t.advance(1.2);
  assert.equal(t.runtime.view().player.hp,hp,'leaving the committed aim point avoids the bolt');
  t.context.player.x-=4;
  let hurt=false;
  for(let i=0;i<100&&!hurt;i++){
    await t.advance(.05);hurt=t.runtime.view().player.hp<hp;
  }
  assert.equal(hurt,true,'a later bolt must be able to retaliate');
  t.runtime.destroy();
});

test('airborne slot 2 remains learning-gated and its real H2 projectile follows vertical aim',async()=>{
  const unlearned=await fixture();
  const before=unlearned.runtime.snapshot().revision;
  assert.equal(await unlearned.runtime.action({type:'skill-cast',slot:0}),false);
  assert.equal(unlearned.runtime.snapshot().revision,before);
  unlearned.runtime.destroy();
  const t=await fixture({learned:true});
  const hp=t.runtime.view().enemies[0].hp;
  assert.equal(await t.runtime.action({type:'skill-cast',slot:0}),true,t.runtime.view().error);
  await t.advance(1.5);
  assert.ok(t.runtime.view().enemies[0].hp<hp,'vertical projectile should hit the ground target from hover');
  assert.ok(t.runtime.snapshot().combat.hits.some(h=>h.targetId===t.target.instanceId));
  t.runtime.destroy();
});

test('off-zone flight cannot cast; R8 local blast damages two actors in one root revision',async()=>{
  const t=await fixture({realm:8,two:true});
  t.context.combatZone=false;
  const before=t.runtime.snapshot().revision;
  assert.equal(await t.runtime.action({type:'attack'}),false);
  assert.equal(t.runtime.snapshot().revision,before);
  t.context.combatZone=true;
  const resource=t.runtime.view().player.resource;
  assert.equal(await t.runtime.action({type:'attack'}),true,t.runtime.view().error);
  const cast=t.runtime.combatView().aerialCasts.find(c=>c.sourceId==='player');
  assert.equal(cast.kind,'void-break');assert.equal(cast.realm,8);
  assert.ok(t.runtime.view().player.resource<resource,'startup spends real resource');
  await t.advance(1.5);
  assert.equal(t.runtime.snapshot().combat.hits.filter(h=>h.castId===cast.castId).length,0,'long telegraph cannot deal early damage');
  await t.advance(.35);
  const root=t.runtime.snapshot(),hits=root.combat.hits.filter(h=>h.castId===cast.castId);
  assert.equal(hits.length,2);
  assert.ok(root.receipts.some(r=>{const request=JSON.parse(r.signature);return request.kind==='hit'&&request.hits?.length===2;}));
  t.runtime.destroy();
});

test('leaving the combat chart during windup cancels the committed attack without delayed damage',async()=>{
  const t=await fixture();
  assert.equal(await t.runtime.action({type:'attack'}),true);
  const hp=t.runtime.view().enemies[0].hp;
  t.context.combatZone=false;t.context.remote=true;t.context.playing=false;
  await t.advance(.05);
  assert.equal(t.runtime.combatView().ascensionCast.resolved,true);
  t.context.combatZone=true;t.context.remote=false;t.context.playing=true;
  await t.advance(.8);
  assert.equal(t.runtime.view().enemies[0].hp,hp);
  t.runtime.destroy();
});

test('R8 cannot leave its local aim behind and damage actors hundreds of metres away',async()=>{
  const t=await fixture({realm:8,two:true});
  assert.equal(await t.runtime.action({type:'attack'}),true);
  const cast=t.runtime.combatView().ascensionCast;
  t.context.player.x+=120;
  await t.advance(1.9);
  assert.equal(t.runtime.snapshot().combat.hits.filter(h=>h.castId===cast.id).length,0);
  t.runtime.destroy();
});
