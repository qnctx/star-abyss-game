import test from 'node:test';
import assert from 'node:assert/strict';
import {createExpeditionRuntime,sceneConfigFor} from '../src/expedition-runtime/index.mjs';
import {definitions} from '../src/expedition-world/definitions.mjs';
import {baseResource,computeAttributes} from '../src/d3-combat/index.mjs';
import {validateScene} from '../src/d3-session/scene.mjs';
import {RIFTWING_ID,RIFTWING_ENEMY} from '../src/expedition-runtime/rules.mjs';
import {advanceRiftwing,initialRiftwingState,riftwingSweep,RIFTWING_ATTACKS,RIFTWING_ENVELOPE,riftwingContact} from '../src/expedition-runtime/riftwing-ai.mjs';
import {createWorldQueries} from '../src/expedition-world/queries.mjs';
import {createExpeditionQueries} from '../src/expedition-runtime/queries.mjs';

const clearQueries=(blocked=()=>false)=>({terrainHeight:()=>0,canOccupy:()=>true,canTraverse:(a,b)=>!blocked(a,b),
  canAirTraverse:(a,b)=>!blocked(a,b),hasLineOfSight:(a,b)=>!blocked(a,b),dynamicBlocked:()=>false});

test('the real north-ridge site supports a grounded spawn and swept takeoff',()=>{
 const q=createWorldQueries(),p=RIFTWING_ENEMY,y=q.terrainHeight(p.x,p.z);
 assert.ok(Number.isFinite(y));assert.equal(q.canOccupy(p,p.radius),true);
 assert.equal(q.canAirTraverse({x:p.x,y:y+.18,z:p.z},{x:p.x,y:y+.5,z:p.z},RIFTWING_ENVELOPE.transitionRadius,p.height),true);
 const composed=createExpeditionQueries({worldQueries:q,getVehicle:()=>({x:0,y:0,z:190,yaw:0})});
 assert.equal(composed.canAirTraverse({x:p.x,y:y+.18,z:p.z},{x:p.x,y:y+.5,z:p.z},RIFTWING_ENVELOPE.transitionRadius,p.height),true);
 assert.equal(q.canTraverse({x:p.x,y,z:p.z},{x:p.x,y,z:p.z+1},RIFTWING_ENVELOPE.groundRadius),true);
 assert.equal(q.canTraverse({x:p.x,y,z:p.z},{x:p.x,y,z:p.z+6},RIFTWING_ENVELOPE.groundRadius),true,'the F2 south-side ground approach must be playable');
 assert.equal(riftwingSweep(composed,{x:p.x,y,z:p.z},{x:p.x,y:q.terrainHeight(p.x,p.z+.2),z:p.z+.2},
   {air:false,radius:RIFTWING_ENVELOPE.groundRadius}),true,'ground locomotion also fits the expanded body volume');
 for(let altitude=y+8;altitude>y+.18;){
   const next=Math.max(y+.18,altitude-.7);
   assert.equal(q.canAirTraverse({x:p.x,y:altitude,z:p.z},{x:p.x,y:next,z:p.z},RIFTWING_ENVELOPE.airRadius,p.height),true,'an airborne corpse can fall through the actual site shell');
   altitude=next;
 }
});

test('winged movement follows one bounded ground-takeoff-air-landing path and refuses blocked/ceiling sweeps',()=>{
 const queries=clearQueries(),def={...RIFTWING_ENEMY,home:{x:0,z:0},territoryRadius:90};
 let loc={x:0,y:0,z:0,yaw:0},state=initialRiftwingState(),now=0;
 const step=(player,seconds,query=queries)=>{for(let n=0;n<seconds*20;n++){now+=.05;const result=advanceRiftwing({location:loc,state,player,def,now,dt:.05,queries:query});
   assert.ok(Math.hypot(result.location.x-loc.x,result.location.y-loc.y,result.location.z-loc.z)<1.21,'no frame teleports');loc=result.location;state=result.state;}return {loc,state};};
 step({x:0,y:0,z:-8},.5);assert.equal(state.mode,'ground');assert.ok(loc.z<0&&loc.z>-8);
 step({x:0,y:12,z:-8},1.5);assert.equal(state.mode,'air');assert.ok(loc.y>2&&loc.y<=12);
 const airborneY=loc.y;step({x:0,y:0,z:-8},2);assert.equal(state.mode,'ground');assert.equal(loc.y,0);assert.ok(airborneY>0);
 step({x:200,y:0,z:0},2);assert.equal(state.mode,'ground');assert.ok(loc.z>-8,'losing territory returns along the ground');
 const blocked=clearQueries(()=>true),before={...loc};step({x:0,y:12,z:-9},.5,blocked);assert.equal(loc.x,before.x);assert.equal(loc.z,before.z);
 assert.equal(riftwingSweep(queries,{x:0,y:1998,z:0},{x:0,y:1999,z:0}),false,'wing clearance stays below the 2000m cap');
 assert.equal(riftwingSweep({...queries,canAirTraverse:undefined},{x:0,y:10,z:0},{x:0,y:10,z:-.2}),false,'missing volume query blocks air movement');
 assert.equal(riftwingContact({x:0,y:8,z:0},{x:0,y:8,z:-2},0,RIFTWING_ATTACKS.dive,queries),true);
 assert.equal(riftwingContact({x:0,y:8,z:0},{x:0,y:12,z:-2},0,RIFTWING_ATTACKS.dive,queries),false);
});

test('ground feet follow the sampled slope and a blocked expanded wing never lifts by assignment',()=>{
 const slope={...clearQueries(),terrainHeight:(x,z)=>z*.1},def={...RIFTWING_ENEMY,home:{x:0,z:0}},player={x:0,y:.8,z:8};
 let loc={x:0,y:0,z:0,yaw:0},state=initialRiftwingState();
 for(let i=1;i<=10;i++){
   const result=advanceRiftwing({location:loc,state,player,def,now:i*.05,dt:.05,queries:slope});loc=result.location;state=result.state;
   assert.ok(Math.abs(loc.y-slope.terrainHeight(loc.x,loc.z))<1e-8,'ground feet do not hover or sink on a rising path');
 }
 assert.ok(loc.z>0);
 const blocked={...slope,canAirTraverse:()=>false};
 const before={...loc},result=advanceRiftwing({location:loc,state,player:{...player,y:12},def,now:1,dt:.05,queries:blocked});
 assert.equal(result.state.mode,'ground');assert.deepEqual([result.location.x,result.location.y,result.location.z],[before.x,before.y,before.z],
   'a refused transition cannot lift or pass through the obstacle');
});

async function fixture({realm=4,attack=null,blocked=()=>false}={}){
 const context={playing:true,menu:true,skillMenu:false,remote:false,mounted:false,airborne:false,flying:false,combatZone:true,dashing:false,prone:false,
   player:{x:RIFTWING_ENEMY.x,y:0,z:RIFTWING_ENEMY.z+6,yaw:0,pitch:0}};
 const world={...definitions,sites:[],resources:[],enemies:[]},link={worldId:'test-lab:arena:riftwing-r11',playerId:'test-lab:player'};
 let saved=null,serial=0,failNext=false;const impulses=[];
 const storage={load:async()=>structuredClone(saved),initialize:async root=>{saved=structuredClone(root);const p=saved.combat.actors.find(a=>a.id===link.playerId),stats=computeAttributes({realm}).effective;
   p.realm=realm;p.hp=stats.maxHp;p.maxHp=stats.maxHp;p.attack=attack??stats.attack;p.defense=stats.defense;p.resource=baseResource(realm,1);},close(){},compareAndSwap:async({expectedRevision,nextState})=>{
   if(failNext){failNext=false;return false;}if(saved.revision!==expectedRevision)return false;saved=structuredClone(nextState);return true;}};
 const create=()=>createExpeditionRuntime({link,world,queries:clearQueries(blocked),getContext:()=>context,openStorage:async()=>storage,
   makeId:()=>`riftwing-${++serial}`,isVisible:()=>false,onAirImpulse:v=>impulses.push(v),checkpointStorageName:null});
 let runtime=await create();
 async function advance(seconds,{allowError=false}={}){const frames=Math.ceil(seconds*20);for(let i=0;i<frames;i++){runtime.tick(.05);while(runtime.busy)await new Promise(resolve=>setImmediate(resolve));if(!allowError)assert.equal(runtime.view().error,'');}}
 return {context,link,storage,impulses,advance,create,get runtime(){return runtime;},async reload(){runtime.destroy();runtime=await create();},failOne(){failNext=true;},saved:()=>structuredClone(saved),replaceSaved:value=>{saved=structuredClone(value);}};
}

test('isolated encounter uses one actor through ground chase, real ground punch, flight pursuit, landing and reload',async()=>{
 const t=await fixture();assert.equal(await t.runtime.action({type:'riftwing-encounter'}),true,t.runtime.view().error);
 const first=t.runtime.view().enemies.find(e=>e.id===RIFTWING_ID);assert.ok(first);assert.equal(first.kind,'riftwing');
 assert.equal(first.mode,'ground');assert.equal(first.y,0);
 t.context.menu=false;await t.advance(.3);
 const pursued=t.runtime.view().enemies.find(e=>e.id===RIFTWING_ID);
 assert.equal(pursued.instanceId,first.instanceId);assert.ok(pursued.z>first.z&&pursued.z-first.z<2.1);
 Object.assign(t.context.player,{x:pursued.x,y:0,z:pursued.z+1.4,yaw:0});
 const hp=pursued.hp;assert.equal(await t.runtime.action({type:'air-melee'}),true,t.runtime.view().error);
 await t.advance(.2);assert.ok(t.runtime.view().enemies.find(e=>e.instanceId===first.instanceId).hp<hp,'ground combo changes authoritative actor HP');
 Object.assign(t.context,{flying:true,airborne:true});Object.assign(t.context.player,{y:12,z:pursued.z+5});
 await t.advance(1.4);const flying=t.runtime.view().enemies.find(e=>e.instanceId===first.instanceId);
 assert.ok(['takeoff','air'].includes(flying.mode));assert.ok(flying.y>0&&flying.y<12);assert.equal(flying.instanceId,first.instanceId);
 assert.equal(validateScene(t.runtime.snapshot().scene,t.runtime.snapshot(),sceneConfigFor(t.link.playerId)),true);
 assert.equal(await t.runtime.checkpoint(),true);await t.reload();const restored=t.runtime.view().enemies.find(e=>e.instanceId===first.instanceId);
 assert.ok(restored);assert.equal(restored.mode,flying.mode);assert.equal(restored.hp,flying.hp);assert.ok(Math.abs(restored.y-flying.y)<.01);
 assert.ok(t.runtime.snapshot().scene.riftwings[first.instanceId].aggroUntil>t.runtime.snapshot().scene.time,'saved pursuit survives a reload');
 Object.assign(t.context,{flying:false,airborne:false});t.context.player.y=0;await t.advance(2);
 const landed=t.runtime.view().enemies.find(e=>e.instanceId===first.instanceId);assert.equal(landed.mode,'ground');assert.equal(landed.y,0);
 t.runtime.destroy();
});

test('aerial death creates one CAS drop, falling corpse settles before pickup and never respawns on reload',async()=>{
 const t=await fixture({realm:9});await t.runtime.action({type:'riftwing-encounter'});t.context.menu=false;
 const enemy=t.runtime.view().enemies.find(e=>e.id===RIFTWING_ID);
 Object.assign(t.context,{flying:true,airborne:true});Object.assign(t.context.player,{x:enemy.x,y:9,z:enemy.z+5,yaw:0});
 await t.advance(1.7);const airborne=t.runtime.view().enemies.find(e=>e.instanceId===enemy.instanceId);assert.ok(airborne.y>2);
 Object.assign(t.context.player,{x:airborne.x,y:airborne.y,z:airborne.z+1.35,yaw:0});
 assert.equal(await t.runtime.action({type:'air-melee'}),true,JSON.stringify({error:t.runtime.view().error,melee:t.runtime.combatView().aerialMelee,pending:t.runtime.snapshot().scene.pending}));await t.advance(.25);
 const after=t.runtime.view().enemies.find(e=>e.instanceId===enemy.instanceId);
 assert.equal(after.alive,false,'death is committed to the existing combat actor');
 assert.equal(t.runtime.snapshot().drops.filter(d=>d.memberId===enemy.instanceId&&d.created).length,1);
 assert.equal(t.runtime.view().nearby,null,'loot is inaccessible before the corpse lands');
 await t.advance(1);const settled=t.runtime.view().enemies.find(e=>e.instanceId===enemy.instanceId);assert.equal(settled.y,0);assert.equal(settled.mode,'dead');
 Object.assign(t.context,{flying:false,airborne:false});Object.assign(t.context.player,{x:settled.x,y:0,z:settled.z+1});
 const before=t.runtime.view().inventory.items.filter(i=>i.name==='裂翼羽核').reduce((n,i)=>n+i.quantity,0);
 assert.equal(t.runtime.view().nearby?.action,'loot');await t.runtime.action({type:'interact'});
 assert.equal(t.runtime.view().inventory.items.filter(i=>i.name==='裂翼羽核').reduce((n,i)=>n+i.quantity,0),before+1);
 await t.reload();assert.equal(await t.runtime.action({type:'riftwing-encounter'}),false,'one encounter cannot regenerate a dead actor');
 assert.equal(t.runtime.snapshot().drops.filter(d=>d.memberId===enemy.instanceId&&d.created).length,1);
 t.runtime.destroy();
});

test('a wall blocks sight, chase, swept travel and a facing ground punch across it',async()=>{
 const wallZ=RIFTWING_ENEMY.z+.7,blocked=(a,b)=>(a.z-wallZ)*(b.z-wallZ)<0;
 const t=await fixture({blocked});await t.runtime.action({type:'riftwing-encounter'});t.context.menu=false;
 const original=t.runtime.view().enemies.find(e=>e.id===RIFTWING_ID);
 Object.assign(t.context.player,{x:original.x,y:0,z:original.z+1.4,yaw:0});await t.advance(.7);
 const held=t.runtime.view().enemies.find(e=>e.instanceId===original.instanceId);
 assert.equal(held.z,original.z,'blocked line of sight cannot begin pursuit through a building');
 assert.equal(await t.runtime.action({type:'air-melee'}),true);await t.advance(.25);
 assert.equal(t.runtime.view().enemies.find(e=>e.instanceId===original.instanceId).hp,original.hp,'physical contact is denied by the same LOS');
 assert.equal(riftwingSweep(clearQueries(blocked),{x:0,y:8,z:wallZ-.1},{x:0,y:8,z:wallZ+.1}),false);
 t.runtime.destroy();
});

test('a normal R4 character can guard on foot and must land several real combos to beat the R4 hunter',async()=>{
 const t=await fixture();await t.runtime.action({type:'riftwing-encounter'});t.context.menu=false;
 const spawned=t.runtime.view().enemies.find(e=>e.id===RIFTWING_ID),player=t.runtime.view().player;
 assert.ok(spawned.maxHp>=player.maxHp*2,'the same-realm encounter has a real HP budget');
 assert.equal(await t.runtime.action({type:'air-guard',held:true}),true);
 await t.advance(.2);
 assert.equal(t.runtime.combatView().aerialMelee.guarding,true,'held ground guard survives simulation ticks');
 assert.equal(await t.runtime.action({type:'air-melee'}),false,'guarding cannot attack');
 assert.equal(await t.runtime.action({type:'air-guard',held:false}),true);
 assert.equal(t.runtime.combatView().aerialMelee.guarding,false);
 let landed=0;
 for(let attempt=0;attempt<140&&t.runtime.view().enemies.find(e=>e.instanceId===spawned.instanceId).alive;attempt++){
   const enemy=t.runtime.view().enemies.find(e=>e.instanceId===spawned.instanceId);
   Object.assign(t.context.player,{x:enemy.x,y:0,z:enemy.z+1.35,yaw:0});
   const before=enemy.hp;
   if(await t.runtime.action({type:'air-melee'})){await t.advance(.22);if(t.runtime.view().enemies.find(e=>e.instanceId===spawned.instanceId).hp<before){landed++;if(landed===1)assert.equal(t.runtime.view().enemies.find(e=>e.instanceId===spawned.instanceId).alive,true);}}
   await t.advance(.28);
 }
 assert.ok(landed>=3,`the fight must survive more than a single R4 hit, got ${landed}`);
 assert.equal(t.runtime.view().enemies.find(e=>e.instanceId===spawned.instanceId).alive,false,'repeated real hit transactions can win');
 t.runtime.destroy();
});

test('one creature actor commits a claw hit on foot and a telegraphed dive plus sweep in the air',async()=>{
 const ground=await fixture();await ground.runtime.action({type:'riftwing-encounter'});ground.context.menu=false;
 const beast=ground.runtime.view().enemies.find(e=>e.id===RIFTWING_ID);
 Object.assign(ground.context.player,{x:beast.x,y:0,z:beast.z+2.4});const firstHp=ground.runtime.view().player.hp;
 await ground.advance(.8);
 assert.ok(ground.runtime.view().player.hp<firstHp,'claw damage is committed to the real player actor');
 assert.ok(ground.runtime.snapshot().combat.casts.some(c=>c.snapshot.skillId==='expedition-riftwing-claw'));
 assert.ok(ground.runtime.snapshot().combat.hits.some(h=>h.targetId===ground.link.playerId));
 ground.runtime.destroy();
 const air=await fixture();await air.runtime.action({type:'riftwing-encounter'});air.context.menu=false;
 const target=air.runtime.view().enemies.find(e=>e.id===RIFTWING_ID);
 Object.assign(air.context,{flying:true,airborne:true});Object.assign(air.context.player,{x:target.x,y:9,z:target.z+5});
 const airHp=air.runtime.view().player.hp;await air.advance(3.3);
 const moves=air.runtime.snapshot().combat.casts.filter(c=>c.sourceId===target.instanceId).map(c=>c.snapshot.skillId);
 assert.ok(moves.includes('expedition-riftwing-dive'),`expected dive, got ${moves}`);
 assert.ok(moves.includes('expedition-riftwing-sweep'),`expected close-range sweep, got ${moves}`);
 assert.ok(air.runtime.view().player.hp<airHp);
 assert.equal(air.runtime.view().enemies.find(e=>e.instanceId===target.instanceId).hp,target.hp);
 air.runtime.destroy();
});

test('rejected hit CAS cannot create damage or loot, and an R10 scene without wing state can retry',async()=>{
 const t=await fixture({realm:9});await t.runtime.action({type:'riftwing-encounter'});t.context.menu=false;
 const enemy=t.runtime.view().enemies.find(e=>e.id===RIFTWING_ID);
 Object.assign(t.context.player,{x:enemy.x,y:0,z:enemy.z+1.35,yaw:0});
 assert.equal(await t.runtime.action({type:'air-melee'}),true);t.failOne();
 for(let i=0;i<4;i++){t.runtime.tick(.05);while(t.runtime.busy)await new Promise(resolve=>setImmediate(resolve));}
 const failed=t.saved();assert.equal(Number(failed.combat.actors.find(a=>a.id===enemy.instanceId).hp),enemy.hp);
 assert.equal(failed.drops.filter(d=>d.memberId===enemy.instanceId&&d.created).length,0);
 await t.advance(.25);assert.ok(t.runtime.view().enemies.find(e=>e.instanceId===enemy.instanceId).hp<enemy.hp,'the saved cast can retry after the failed write');
 // Historical R10 saves cannot contain a riftwing actor; remove this new
 // encounter before checking the optional extension migration.
 const legacy=await fixture();assert.equal(await legacy.runtime.checkpoint(),true);
 const scene=legacy.saved();delete scene.scene.riftwings;assert.equal(validateScene(scene.scene,scene,sceneConfigFor(legacy.link.playerId)),true);
 legacy.replaceSaved(scene);legacy.failOne();assert.equal(await legacy.runtime.checkpoint(),false);
 assert.equal(await legacy.runtime.checkpoint(),true);assert.ok(legacy.runtime.snapshot().scene.riftwings);
 legacy.runtime.destroy();t.runtime.destroy();
});
