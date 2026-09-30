import test from 'node:test';
import assert from 'node:assert/strict';
import {createExpeditionRuntime,sceneConfigFor} from '../src/expedition-runtime/index.mjs';
import {definitions} from '../src/expedition-world/definitions.mjs';
import {baseResource} from '../src/d3-combat/index.mjs';
import {validateScene} from '../src/d3-session/scene.mjs';
import {AIR_MELEE,nextMeleeMove,meleeContact,guardedImpact} from '../src/expedition-runtime/aerial-melee.mjs';
import {ARENA_ID} from '../src/expedition-runtime/rules.mjs';

test('punch and kick need body-distance, facing, height and visible contact; guard has a real parry and break window',()=>{
 const ground=()=>0,clear=()=>true,from={x:0,y:6,z:0},near={x:0,y:6,z:-1.5};
 assert.equal(meleeContact(from,near,0,AIR_MELEE.jab,clear,ground),true);
 assert.equal(meleeContact(from,{...near,z:-2.5},0,AIR_MELEE.jab,clear,ground),false);
 assert.equal(meleeContact(from,near,Math.PI,AIR_MELEE.jab,clear,ground),false);
 assert.equal(meleeContact(from,{...near,y:9},0,AIR_MELEE.kick,clear,ground),false);
 assert.equal(meleeContact(from,near,0,AIR_MELEE.jab,()=>false,ground),false);
 assert.deepEqual([nextMeleeMove(0,-1e9,1).move,nextMeleeMove(1,1,1.5).move,nextMeleeMove(2,1.5,2).move],['jab','cross','kick']);
 assert.equal(nextMeleeMove(2,1.5,2,true).move,'uppercut');
 assert.equal(nextMeleeMove(3,2,2.4).move,'jab','third strike finishes the chain');
 assert.equal(nextMeleeMove(1,1,2.3).move,'cross','the extended link window permits one repositioning step');
 assert.equal(nextMeleeMove(1,1,2.36).move,'jab','a late new press begins a fresh chain');
 const guarding={guarding:true,guardSince:1,guardBreakUntil:0,guardYaw:0,guardMeter:0};
 assert.equal(guardedImpact(guarding,{x:0,y:6,z:-1},{x:0,y:6,z:0},1.1,ground).kind,'parry');
 assert.equal(guardedImpact({...guarding,guardMeter:80},{x:0,y:6,z:-1},{x:0,y:6,z:0},1.4,ground).kind,'break');
});

async function arenaFixture(){
 const context={playing:true,menu:false,skillMenu:false,remote:false,mounted:false,airborne:false,flying:false,combatZone:false,dashing:false,prone:false,
  player:{x:126,y:0,z:52,yaw:0,pitch:0}};
 const world={...definitions,sites:[],resources:[],enemies:[]};let saved=null,serial=0,wall=0,pauseNext=false,resume=null,failNextCAS=false;const impulses=[];
 const storage={load:async()=>structuredClone(saved),initialize:async root=>{const next=structuredClone(root),p=next.combat.actors.find(a=>a.id==='test-lab:player');p.realm=4;p.resource=baseResource(4,1);saved=next;},close(){},compareAndSwap:async({expectedRevision,nextState})=>{if(pauseNext){pauseNext=false;await new Promise(resolve=>{resume=resolve;});}if(failNextCAS){failNextCAS=false;return false;}if(saved.revision!==expectedRevision)return false;saved=structuredClone(nextState);return true;}};
 const queries={terrainHeight:()=>0,canOccupy:()=>true,canTraverse:()=>true,hasLineOfSight:()=>true,dynamicBlocked:()=>false};
 const link={worldId:'test-lab:arena:fixture',playerId:'test-lab:player'};
 const runtime=await createExpeditionRuntime({link,world,queries,getContext:()=>context,openStorage:async()=>storage,makeId:()=>`melee-${++serial}`,clockMs:()=>wall,isVisible:()=>false,onAirImpulse:v=>impulses.push(v)});
 async function advance(seconds){for(let i=0;i<Math.ceil(seconds*20);i++){wall+=50;runtime.tick(.05);while(runtime.busy)await new Promise(resolve=>setImmediate(resolve));assert.equal(runtime.view().error,'');}}
 return {runtime,context,advance,storage,impulses,elapseMs:ms=>{wall+=ms;},saved:()=>structuredClone(saved),replaceSaved:value=>{saved=structuredClone(value);},failOneCAS:()=>{failNextCAS=true;},holdNextSave(){pauseNext=true;return async()=>{while(!resume)await new Promise(resolve=>setImmediate(resolve));const release=resume;resume=null;release();}}};
}

test('arena sparring uses a real spawned actor, isolated world ID and validated CAS scene',async()=>{
 const t=await arenaFixture();
 assert.equal(await t.runtime.action({type:'air-sparring'}),true,t.runtime.view().error);
 const enemy=t.runtime.view().enemies.find(e=>e.sparring);
 assert.ok(enemy);assert.equal(enemy.id,ARENA_ID);assert.ok(enemy.hp>96);
 const root=t.runtime.snapshot();assert.ok(root.combat.actors.some(a=>a.id===enemy.instanceId));
 assert.equal(validateScene(root.scene,root,sceneConfigFor('test-lab:player')),true);
 t.runtime.destroy();
});

test('flying melee commits a costed punch and hit, then eases the real opponent position',async()=>{
 const t=await arenaFixture();assert.equal(await t.runtime.action({type:'air-sparring'}),true);
 const enemy=t.runtime.view().enemies.find(e=>e.sparring);
 Object.assign(t.context,{airborne:true,flying:true,combatZone:true});Object.assign(t.context.player,{x:enemy.x,y:12,z:enemy.z+1.4,yaw:0,pitch:0});
 let lunge=null;for(let i=0;i<65&&!lunge;i++){await t.advance(.05);lunge=t.runtime.snapshot().scene.pending[enemy.instanceId];}
 assert.equal(lunge?.kind,'air-melee-lunge');
 const before=t.runtime.view().enemies.find(e=>e.sparring),hp=before.hp,resource=t.runtime.view().player.resource;
 assert.equal(await t.runtime.action({type:'air-melee'}),true,t.runtime.view().error);
 const move=t.runtime.combatView().aerialMelee;assert.equal(move.move,'jab');assert.equal(move.combo,0);
 assert.ok(t.runtime.view().player.resource<resource);
 await t.advance(.21);
 const after=t.runtime.view().enemies.find(e=>e.sparring);
 assert.ok(after.hp<hp,'the actor HP changes only through a committed hit');
 assert.ok(t.runtime.snapshot().combat.hits.some(h=>h.targetId===enemy.instanceId));
 const atContact={x:after.x,y:after.y,z:after.z};await t.advance(.2);
 const eased=t.runtime.view().enemies.find(e=>e.sparring);
 assert.ok(Math.hypot(eased.x-atContact.x,eased.z-atContact.z)>0,'knockback moves across later ticks, not on the hit frame');
 assert.equal(validateScene(t.runtime.snapshot().scene,t.runtime.snapshot(),sceneConfigFor('test-lab:player')),true);
 t.runtime.destroy();
});

test('hold guard clears on key release and cannot remain active after leaving flight',async()=>{
 const t=await arenaFixture();await t.runtime.action({type:'air-sparring'});
 Object.assign(t.context,{airborne:true,flying:true,combatZone:true});Object.assign(t.context.player,{x:126,y:12,z:50,yaw:0});
 assert.equal(await t.runtime.action({type:'air-guard',held:true}),true,t.runtime.view().error);
 assert.equal(t.runtime.combatView().aerialMelee.guarding,true);
 const casts=t.runtime.snapshot().combat.casts.length;
 assert.equal(await t.runtime.action({type:'attack'}),false,'R cannot bypass an active air guard');
 assert.equal(await t.runtime.action({type:'skill-cast',slot:0}),false,'aerial learned-skill input cannot bypass the guard');
 assert.equal(t.runtime.snapshot().combat.casts.length,casts);
 assert.equal(await t.runtime.action({type:'air-guard',held:false}),true,t.runtime.view().error);
 assert.equal(t.runtime.combatView().aerialMelee.guarding,false);
 await t.runtime.action({type:'air-guard',held:true});t.context.combatZone=false;t.context.remote=true;t.context.playing=false;
 await t.advance(.05);assert.equal(t.runtime.combatView().aerialMelee.guarding,false);
 t.runtime.destroy();
});

test('a timed airborne guard parries an actual lunge without a damage receipt, then opens an uppercut counter',async()=>{
 const t=await arenaFixture();await t.runtime.action({type:'air-sparring'});
 const enemy=t.runtime.view().enemies.find(e=>e.sparring);
 Object.assign(t.context,{airborne:true,flying:true,combatZone:true});Object.assign(t.context.player,{x:enemy.x,y:12,z:enemy.z+1.4,yaw:0,pitch:0});
 let lunge=null;for(let i=0;i<65&&!lunge;i++){await t.advance(.05);lunge=t.runtime.snapshot().scene.pending[enemy.instanceId];}
 assert.equal(lunge?.kind,'air-melee-lunge');
 const remaining=Math.max(0,lunge.due-t.runtime.snapshot().scene.time-.1);await t.advance(remaining);
 const hp=t.runtime.view().player.hp;
 assert.equal(await t.runtime.action({type:'air-guard',held:true}),true,t.runtime.view().error);
 await t.advance(.16);
 assert.equal(t.runtime.view().player.hp,hp);
 assert.equal(t.runtime.snapshot().combat.hits.filter(h=>h.castId===lunge.castId).length,0);
 assert.ok(t.runtime.combatView().aerialMelee.counterUntil>t.runtime.combatView().time);
 assert.equal(t.runtime.combatView().aerialMelee.opponents[0].reaction?.kind,'impact','parry recoils the attacker, not the guarding player');
 await t.runtime.action({type:'air-guard',held:false});
 assert.equal(await t.runtime.action({type:'air-melee'}),true,t.runtime.view().error);
 assert.equal(t.runtime.combatView().aerialMelee.move,'uppercut');
 t.runtime.destroy();
});

test('a confirmed jab interrupts a pending lunge in the same saved hit transaction',async()=>{
 const t=await arenaFixture();await t.runtime.action({type:'air-sparring'});
 const enemy=t.runtime.view().enemies.find(e=>e.sparring);
 Object.assign(t.context,{airborne:true,flying:true,combatZone:true});Object.assign(t.context.player,{x:enemy.x,y:12,z:enemy.z+1.4,yaw:0,pitch:0});
 let lunge=null;for(let i=0;i<65&&!lunge;i++){await t.advance(.05);lunge=t.runtime.snapshot().scene.pending[enemy.instanceId];}
 assert.equal(lunge?.kind,'air-melee-lunge');
 const playerHp=t.runtime.view().player.hp,enemyHp=t.runtime.view().enemies.find(e=>e.sparring).hp;
 assert.equal(await t.runtime.action({type:'air-melee'}),true,t.runtime.view().error);
 await t.advance(.21);
 const root=t.runtime.snapshot();
 assert.ok(t.runtime.view().enemies.find(e=>e.sparring).hp<enemyHp);
 assert.equal(root.scene.pending[enemy.instanceId].resolved,true,'the attacker stun and cast interruption share the hit CAS');
 assert.equal(validateScene(root.scene,root,sceneConfigFor('test-lab:player')),true);
 await t.advance(.5);
 assert.equal(t.runtime.view().player.hp,playerHp,'the interrupted lunge cannot damage after its original contact time');
 assert.equal(t.runtime.snapshot().combat.hits.filter(h=>h.castId===lunge.castId).length,0);
 t.runtime.destroy();
});

test('three separate N presses commit punch, punch, kick casts against the same real actor',async()=>{
 const t=await arenaFixture();await t.runtime.action({type:'air-sparring'});
 Object.assign(t.context,{airborne:true,flying:true,combatZone:true});
 t.context.player.y=12;t.context.player.z=definitions.safePoint.z+30;await t.advance(1.6);
 const expected=['jab','cross','kick'];
 for(const move of expected){
  const enemy=t.runtime.view().enemies.find(e=>e.sparring);
  Object.assign(t.context.player,{x:enemy.x,y:enemy.y,z:enemy.z+1.35,yaw:0,pitch:0});
  let committed=false;for(let i=0;i<30&&!committed;i++){committed=await t.runtime.action({type:'air-melee'});if(!committed)await t.advance(.05);}
  assert.equal(committed,true,'the recovery/stun window must eventually reopen');
  assert.equal(t.runtime.combatView().aerialMelee.move,move);
  await t.advance(move==='kick'?.8:.48);
 }
 const skills=t.runtime.snapshot().combat.casts.filter(c=>c.sourceId==='test-lab:player').map(c=>c.snapshot.skillId);
 assert.deepEqual(skills.slice(-3),expected.map(move=>'expedition-air-melee-'+move));
 t.runtime.destroy();
});

test('hitstun gates R and learned-skill input while the player is still airborne',async()=>{
 const t=await arenaFixture();await t.runtime.action({type:'air-sparring'});
 const enemy=t.runtime.view().enemies.find(e=>e.sparring);
 Object.assign(t.context,{airborne:true,flying:true,combatZone:true});Object.assign(t.context.player,{x:enemy.x,y:12,z:enemy.z+1.4,yaw:0,pitch:0});
 let lunge=null;for(let i=0;i<65&&!lunge;i++){await t.advance(.05);lunge=t.runtime.snapshot().scene.pending[enemy.instanceId];}
 assert.ok(lunge);const hp=t.runtime.view().player.hp;
 await t.advance(Math.max(.05,lunge.due-t.runtime.snapshot().scene.time+.05));
 assert.ok(t.runtime.view().player.hp<hp);
 assert.ok(t.runtime.combatView().aerialMelee.stunUntil>t.runtime.combatView().time);
 const casts=t.runtime.snapshot().combat.casts.length;
 assert.equal(await t.runtime.action({type:'attack'}),false);
 assert.equal(await t.runtime.action({type:'skill-cast',slot:0}),false);
 assert.equal(t.runtime.snapshot().combat.casts.length,casts);
 t.runtime.destroy();
});

test('one N pressed during a checkpoint is consumed once; repeats, expiry and menus cannot chain it',async()=>{
 const t=await arenaFixture();await t.runtime.action({type:'air-sparring'});
 Object.assign(t.context,{airborne:true,flying:true,combatZone:true});Object.assign(t.context.player,{x:126,y:12,z:220,yaw:0,pitch:0});
 const release=t.holdNextSave(),checkpoint=t.runtime.checkpoint();
 assert.equal(await t.runtime.action({type:'air-melee'}),true,'checkpoint accepts a single short buffered press');
 assert.equal(await t.runtime.action({type:'air-melee',repeat:true}),false);
 assert.equal(await t.runtime.action({type:'air-melee'}),false,'the buffer has one slot');
 await release();await checkpoint;while(t.runtime.busy)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.runtime.snapshot().combat.casts.filter(c=>c.sourceId==='test-lab:player').length,1);
 await t.advance(.7);
 assert.equal(t.runtime.snapshot().combat.casts.filter(c=>c.sourceId==='test-lab:player').length,1,'no held-key auto combo');
 const releaseExpired=t.holdNextSave(),checkpointExpired=t.runtime.checkpoint();
 assert.equal(await t.runtime.action({type:'air-melee'}),true);t.elapseMs(251);
 await releaseExpired();await checkpointExpired;await t.advance(.1);
 assert.equal(t.runtime.snapshot().combat.casts.filter(c=>c.sourceId==='test-lab:player').length,1,'expired input cannot fire');
 const releaseMenu=t.holdNextSave(),checkpointMenu=t.runtime.checkpoint();
 assert.equal(await t.runtime.action({type:'air-melee'}),true);t.context.menu=true;
 await releaseMenu();await checkpointMenu;t.context.menu=false;await t.advance(.1);
 assert.equal(t.runtime.snapshot().combat.casts.filter(c=>c.sourceId==='test-lab:player').length,1,'menu closes the buffer');
 t.runtime.destroy();
});

test('one N in the final 0.2 seconds of melee recovery advances only one combo step',async()=>{
 const t=await arenaFixture();await t.runtime.action({type:'air-sparring'});
 Object.assign(t.context,{airborne:true,flying:true,combatZone:true});Object.assign(t.context.player,{x:126,y:12,z:220,yaw:0,pitch:0});
 assert.equal(await t.runtime.action({type:'air-melee'}),true);await t.advance(.25);
 assert.equal(t.runtime.combatView().aerialMelee.move,'jab');
 assert.equal(await t.runtime.action({type:'air-melee'}),true);
 assert.equal(await t.runtime.action({type:'air-melee'}),false);
 await t.advance(.25);
 const casts=t.runtime.snapshot().combat.casts.filter(c=>c.sourceId==='test-lab:player').map(c=>c.snapshot.skillId);
 assert.deepEqual(casts,['expedition-air-melee-jab','expedition-air-melee-cross']);
 await t.advance(.7);assert.equal(t.runtime.snapshot().combat.casts.filter(c=>c.sourceId==='test-lab:player').length,2);
 t.runtime.destroy();
});

test('an early click during windup is held through recovery, one click per next cast',async()=>{
 const t=await arenaFixture();await t.runtime.action({type:'air-sparring'});
 Object.assign(t.context,{airborne:true,flying:true,combatZone:true});Object.assign(t.context.player,{x:126,y:12,z:220,yaw:0,pitch:0});
 assert.equal(await t.runtime.action({type:'air-melee'}),true);
 assert.equal(await t.runtime.action({type:'air-melee'}),true,'second distinct click queues during jab windup');
 assert.equal(await t.runtime.action({type:'air-melee'}),false,'a third click cannot prefill the kick');
 await t.advance(.5);
 assert.equal(t.runtime.combatView().aerialMelee.move,'cross');
 assert.equal(await t.runtime.action({type:'air-melee'}),true,'one new click during cross queues kick');
 await t.advance(.6);
 const ids=t.runtime.snapshot().combat.casts.filter(c=>c.sourceId==='test-lab:player').map(c=>c.snapshot.skillId);
 assert.deepEqual(ids,['expedition-air-melee-jab','expedition-air-melee-cross','expedition-air-melee-kick']);
 await t.advance(1.1);
 assert.equal(t.runtime.snapshot().combat.casts.filter(c=>c.sourceId==='test-lab:player').length,3,'no fourth cast without another press');
 t.runtime.destroy();
});

test('a second click during the first cast CAS is queued, but not if that cast fails',async()=>{
 const t=await arenaFixture();await t.runtime.action({type:'air-sparring'});
 Object.assign(t.context,{airborne:true,flying:true,combatZone:true});Object.assign(t.context.player,{x:126,y:12,z:220,yaw:0,pitch:0});
 const release=t.holdNextSave(),first=t.runtime.action({type:'air-melee'});
 assert.equal(await t.runtime.action({type:'air-melee'}),true);
 await release();assert.equal(await first,true);await t.advance(.5);
 assert.deepEqual(t.runtime.snapshot().combat.casts.filter(c=>c.sourceId==='test-lab:player').map(c=>c.snapshot.skillId),['expedition-air-melee-jab','expedition-air-melee-cross']);
 t.runtime.destroy();
 const failed=await arenaFixture();await failed.runtime.action({type:'air-sparring'});
 Object.assign(failed.context,{airborne:true,flying:true,combatZone:true});Object.assign(failed.context.player,{x:126,y:12,z:220,yaw:0,pitch:0});
 failed.failOneCAS();const rejected=failed.runtime.action({type:'air-melee'});
 assert.equal(await failed.runtime.action({type:'air-melee'}),true);
 assert.equal(await rejected,false);
 for(let i=0;i<10;i++){failed.elapseMs(50);failed.runtime.tick(.05);while(failed.runtime.busy)await new Promise(resolve=>setImmediate(resolve));}
 assert.equal(failed.runtime.snapshot().combat.casts.filter(c=>c.sourceId==='test-lab:player').length,0,'a follow-up never turns a rejected cast into a new opener');
 failed.runtime.destroy();
});

test('a click during the authoritative hit CAS remains the one buffered follow-up',async()=>{
 const t=await arenaFixture();await t.runtime.action({type:'air-sparring'});
 const enemy=t.runtime.view().enemies.find(e=>e.sparring);
 Object.assign(t.context,{airborne:true,flying:true,combatZone:true});Object.assign(t.context.player,{x:enemy.x,y:12,z:enemy.z+1.4,yaw:0,pitch:0});
 let lunge=null;for(let i=0;i<65&&!lunge;i++){await t.advance(.05);lunge=t.runtime.snapshot().scene.pending[enemy.instanceId];}
 assert.ok(lunge);assert.equal(await t.runtime.action({type:'air-melee'}),true);
 const release=t.holdNextSave();
 for(let i=0;i<8&&!t.runtime.busy;i++){t.elapseMs(50);t.runtime.tick(.05);await new Promise(resolve=>setImmediate(resolve));}
 assert.equal(t.runtime.busy,true,'a real hit transaction is pending');
 assert.equal(await t.runtime.action({type:'air-melee'}),true,'the hit CAS cannot swallow the next click');
 assert.equal(await t.runtime.action({type:'air-melee'}),false);
 await release();while(t.runtime.busy)await new Promise(resolve=>setImmediate(resolve));
 await t.advance(.45);
 assert.deepEqual(t.runtime.snapshot().combat.casts.filter(c=>c.sourceId==='test-lab:player').map(c=>c.snapshot.skillId),['expedition-air-melee-jab','expedition-air-melee-cross']);
 t.runtime.destroy();
});

test('an old R8 scene without melee state survives a rejected CAS and can retry',async()=>{
 const t=await arenaFixture();assert.equal(await t.runtime.checkpoint(),true);
 const old=t.saved();delete old.scene.aerialMelee;
 assert.equal(validateScene(old.scene,old,sceneConfigFor('test-lab:player')),true,'the historical scene shape remains valid');
 t.replaceSaved(old);t.failOneCAS();
 assert.equal(await t.runtime.checkpoint(),false,'first compare-and-swap is rejected');
 assert.equal(t.saved().revision,old.revision,'the rejected write preserved the old save');
 assert.equal(Object.hasOwn(t.saved().scene,'aerialMelee'),false);
 assert.equal(t.runtime.combatView().aerialMelee.guarding,false,'failure hydration did not throw or leave phantom guard');
 assert.equal(await t.runtime.checkpoint(),true,'same runtime can retry after loading the old scene');
 const recovered=t.runtime.snapshot();assert.ok(recovered.scene.aerialMelee);
 assert.equal(validateScene(recovered.scene,recovered,sceneConfigFor('test-lab:player')),true);
 t.runtime.destroy();
});
