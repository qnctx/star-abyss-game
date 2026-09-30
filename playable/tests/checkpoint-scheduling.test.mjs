import test from 'node:test';
import assert from 'node:assert/strict';
import {createExpeditionRuntime} from '../src/expedition-runtime/index.mjs';
import {definitions} from '../src/expedition-world/definitions.mjs';
import {createCheckpointClient} from '../src/performance/checkpoint-client.mjs';
async function setup(){
 let saved,serial=0,hold=false,release,rejectWrite=false;
 const context={playing:true,menu:false,mounted:false,player:{x:0,z:190,y:0,yaw:0,pitch:0}};
 const storage={load:async()=>structuredClone(saved),initialize:async r=>{saved=structuredClone(r);},close(){},compareAndSwap:async({expectedRevision,nextState})=>{if(hold){hold=false;await new Promise(r=>release=r);}if(rejectWrite||saved.revision!==expectedRevision)return false;saved=structuredClone(nextState);return true;}};
 const runtime=await createExpeditionRuntime({link:{worldId:'checkpoint-regression',playerId:'player'},world:{...definitions,resources:[],sites:[definitions.sites[0]],enemies:[definitions.enemies[0]]},queries:{terrainHeight:()=>0,canOccupy:()=>true,canTraverse:()=>true,hasLineOfSight:()=>true,dynamicBlocked:()=>false},getContext:()=>context,openStorage:async()=>storage,makeId:()=>`test-${++serial}`,isVisible:()=>false});
 return {runtime,context,hold(){hold=true;},release(){release();},reject(value){rejectWrite=value;},saved:()=>structuredClone(saved)};
}
test('in-flight checkpoint does not block or rewind player; queued pause persists newest pose',async()=>{
 const t=await setup();t.hold();const first=t.runtime.checkpoint();
 await new Promise(r=>setImmediate(r));assert.equal(t.runtime.busy,true);assert.equal(t.runtime.blocking,false);
 Object.assign(t.context.player,{x:125,z:245,yaw:.7,pitch:.2});t.context.playing=false;
 const paused=t.runtime.checkpoint();t.release();assert.equal(await first,true);assert.equal(await paused,true);
 assert.equal(t.runtime.view().player.x,125);assert.equal(t.saved().scene.player.x,125);assert.equal(t.saved().scene.player.yaw,.7);assert.equal(t.saved().revision,2);t.runtime.destroy();
});
test('checkpoint failure is visible and keeps previous durable record; next explicit checkpoint recovers',async()=>{
 const t=await setup();await t.runtime.checkpoint();const before=t.saved();t.reject(true);t.context.player.x=250;
 assert.equal(await t.runtime.checkpoint(),false);assert.ok(t.runtime.view().error);assert.deepEqual(t.saved(),before);assert.equal(t.runtime.view().player.x,250);
 t.reject(false);assert.equal(await t.runtime.checkpoint(),true);assert.equal(t.saved().scene.player.x,250);assert.equal(t.runtime.view().error,'');t.runtime.destroy();
});
test('worker unavailable or constructor denied returns reliable pre-write fallback',async()=>{
 assert.equal(await createCheckpointClient({}, {WorkerClass:null}),null);
 assert.equal(await createCheckpointClient({}, {WorkerClass:class{constructor(){throw Error('CSP');}}}),null);
});
test('worker boot failure closes worker before fallback',async()=>{
 let terminated=false;
 class BrokenWorker{postMessage(){queueMicrotask(()=>this.onerror());}terminate(){terminated=true;}}
 assert.equal(await createCheckpointClient({}, {WorkerClass:BrokenWorker}),null);assert.ok(terminated);
});
