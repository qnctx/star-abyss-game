import test from 'node:test';import assert from 'node:assert/strict';
import {TEST_LAB,testLabProfile,testLabEnabled,testLabLink,seedTestLabRoot,openTestLabStorage,resetTestLabStorage} from '../src/test-lab-storage.mjs';
import {createExpeditionRuntime} from '../src/expedition-runtime/index.mjs';
import {definitions} from '../src/expedition-world/definitions.mjs';
import {rulesFor,initialRoot} from '../src/expedition-runtime/rules.mjs';
import {validateRoot} from '../src/d3-session/index.mjs';
import {prepareTestLabSession} from '../src/test-lab.mjs';

test('realm profiles require explicit test entry and isolate every high realm database and save',()=>{
 const profiles=[4,5,6,7,8,9].map(realm=>testLabProfile('?testLab=1&realm='+realm));
 assert.deepEqual(profiles.map(p=>p.realm),[4,5,6,7,8,9]);
 assert.equal(new Set(profiles.map(p=>p.db)).size,6);assert.equal(new Set(profiles.map(p=>p.key)).size,6);
 assert.equal(profiles[0].db,TEST_LAB.db);assert.equal(testLabProfile('?realm=9').realm,4);
 for(const realm of ['999','3','6.5','NaN'])assert.equal(testLabProfile('?testLab=1&realm='+realm).realm,4);
});

test('explicit entry and namespace reject production links',()=>{
 assert.equal(testLabEnabled(''),false);assert.equal(testLabEnabled('?testLab=0'),false);assert.equal(testLabEnabled('?testLab=1'),true);
 const link=testLabLink({worldId:'original:formal',playerId:'formal'},false,()=> 'isolated');assert.equal(link.worldId,'test-lab:isolated');
 assert.equal(testLabLink(link),link);assert.notEqual(testLabLink(link,true,()=> 'new').worldId,link.worldId);
});
test('aerial sparring profile is isolated from ordinary realm and formal saves',()=>{
 const ordinary=testLabProfile('?testLab=1&realm=6'),arena=testLabProfile('?testLab=1&realm=6&arena=1');
 assert.equal(arena.arena,true);assert.notEqual(arena.key,ordinary.key);assert.notEqual(arena.db,ordinary.db);
 assert.equal(testLabProfile('?arena=1').arena,undefined);
 assert.notEqual(testLabLink({worldId:'test-lab:arena:foreign',playerId:'test-lab:p'}).worldId,'test-lab:arena:foreign');
});
test('R4 seed validates in real root and derives stats from combat rules',()=>{
 const link=testLabLink(null,false,()=> 'seed'),root=initialRoot(link,rulesFor(definitions),()=>({}));const next=seedTestLabRoot(root,link.playerId);validateRoot(next);
 const actor=next.combat.actors[0];assert.equal(actor.realm,4);assert.equal(actor.maxHp,'155520');assert.equal(actor.attack,'15552');assert.equal(actor.defense,'12960');assert.equal(actor.resource,'1600');assert.equal(root.combat.actors[0].realm,0);
});
test('storage override scopes database, preserves compare-and-swap, rejects formal IDs',async()=>{
 let dbName,stored;const link=testLabLink(null,false,()=> 'runtime');
 const storage=await openTestLabStorage({name:'formal-db',sceneConfig:{playerId:link.playerId}},async options=>{dbName=options.name;return {load:async()=>structuredClone(stored),initialize:async r=>{stored=r;return true;},compareAndSwap:async args=>args.nextState,close(){}};});
 assert.equal(dbName,TEST_LAB.db);await storage.initialize(initialRoot(link,rulesFor(definitions),()=>({})));assert.equal((await storage.load(link.worldId)).combat.actors[0].realm,4);assert.throws(()=>storage.load('original:formal'));
});
test('actual expedition runtime uses R4 combat, harvest transfer and checkpoint persistence',async()=>{
 let saved=null,serial=0;const link=testLabLink(null,false,()=> 'connected');const context={playing:true,menu:false,mounted:false,airborne:false,dashing:false,player:{x:0,z:190,y:0,yaw:0,pitch:0}};
 const memory={load:async()=>structuredClone(saved),initialize:async r=>{saved=structuredClone(r);return true;},compareAndSwap:async({expectedRevision,nextState})=>{if(saved.revision!==expectedRevision)return false;saved=structuredClone(nextState);return true;},close(){}};
 const runtime=await createExpeditionRuntime({link,world:definitions,queries:{terrainHeight:()=>0,canOccupy:()=>true,canTraverse:()=>true,hasLineOfSight:()=>true,dynamicBlocked:()=>false},getContext:()=>context,isVisible:()=>false,openStorage:o=>openTestLabStorage(o,async()=>memory),makeId:()=>`case-${++serial}`});
 async function advance(seconds){for(let i=0;i<seconds*20;i++){runtime.tick(.05);while(runtime.busy)await new Promise(r=>setImmediate(r));}}
 await prepareTestLabSession(runtime);assert.equal(runtime.view().player.maxHp,155520);assert.equal(runtime.view().player.hp,155520,'safe camp preparation cannot damage player');
 const primed=runtime.snapshot().revision;await prepareTestLabSession(runtime);assert.equal(runtime.snapshot().revision,primed,'restore does not respawn test content');
 const resource=definitions.resources[0];Object.assign(context.player,{x:resource.x+2,z:resource.z});await runtime.action({type:'interact'});assert.equal(runtime.view().inventory.items[0].quantity,1);
 const enemy=runtime.view().enemies[0];Object.assign(context.player,{x:enemy.x,z:enemy.z+2,yaw:0});await runtime.action({type:'attack'});await advance(1);
 assert.equal(runtime.view().enemies[0].hp,0);assert.equal(runtime.snapshot().drops.filter(d=>d.created).length,1);assert.ok(runtime.snapshot().revision>1);assert.equal(runtime.view().error,'');await runtime.checkpoint();runtime.destroy();assert.equal(saved.combat.actors.find(a=>a.id===link.playerId).realm,4);
});
test('reset deletes only test names after database deletion succeeds',async()=>{
 const removed=[],deleted=[];await resetTestLabStorage({storage:{removeItem:k=>removed.push(k)},db:{deleteDatabase(name){deleted.push(name);const r={};queueMicrotask(()=>r.onsuccess());return r;}}});assert.deepEqual(deleted,[TEST_LAB.db]);assert.deepEqual(removed,[TEST_LAB.key]);
 await assert.rejects(resetTestLabStorage({storage:{removeItem(){assert.fail('must preserve on blocked deletion');}},db:{deleteDatabase(){const r={};queueMicrotask(()=>r.onblocked());return r;}}}),/另一个测试页面/);
});
test('preparation awaits delayed commits and retries the same root without duplicate objects',async()=>{
 let saved=null,failOnce=true,initializations=0,serial=0;const link=testLabLink(null,false,()=> 'retry');
 const memory={load:async()=>structuredClone(saved),initialize:async r=>{initializations++;saved=structuredClone(r);return true;},close(){},compareAndSwap:async({expectedRevision,nextState})=>{await new Promise(r=>setTimeout(r,3));if(failOnce){failOnce=false;throw Error('injectedCommitFailure');}if(saved.revision!==expectedRevision)return false;saved=structuredClone(nextState);return true;}};
 const context={playing:true,menu:false,mounted:false,airborne:false,dashing:false,player:{x:0,z:190,y:0,yaw:0,pitch:0}};
 const setup=()=>createExpeditionRuntime({link,world:definitions,queries:{terrainHeight:()=>0,canOccupy:()=>true,canTraverse:()=>true,hasLineOfSight:()=>true,dynamicBlocked:()=>false},getContext:()=>context,isVisible:()=>false,openStorage:o=>openTestLabStorage(o,async()=>memory),makeId:()=>`retry-${++serial}`});
 let runtime=await setup();await assert.rejects(prepareTestLabSession(runtime),/injectedCommitFailure/);runtime.destroy();
 runtime=await setup();await prepareTestLabSession(runtime);assert.equal(initializations,1);assert.equal(saved.worldId,link.worldId);assert.equal(runtime.busy,false);assert.ok(runtime.view().resources.some(r=>r.remaining>0));assert.equal(new Set(saved.inventory.items.map(i=>i.itemInstanceId)).size,saved.inventory.items.length);assert.equal(runtime.view().player.hp,155520);runtime.destroy();
});
