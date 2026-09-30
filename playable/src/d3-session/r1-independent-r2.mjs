import {createRoot,createSession,copy,canonical} from '../d3-session/index.mjs';
import {createCombatState,resolveHit} from '../d3-combat/index.mjs';
import {createState} from '../d3-inventory/index.mjs';
import {createDirector} from '../world-director/director.mjs';
import {sampleDefinitions} from '../world-director/definitions.mjs';
export const eq=(a,b,m='full root equality')=>{if(canonical(a)!==canonical(b))throw Error(m);};
const ok=(v,m)=>{if(!v)throw Error(m);};
const cap={maxSlots:12,maxVolumeMl:'1000',maxMassGrams:'1000'};
const item=(definitionId,quantity)=>({definitionId,quantity,maxStack:10,unitVolumeMl:'2',unitMassGrams:'3'});
const defs=copy(sampleDefinitions);
defs.anchors[0].combinations=defs.anchors[0].combinations.map(c=>({...c,count:5}));
defs.anchors[1].combinations=defs.anchors[1].combinations.map(c=>({...c,count:2}));
export const config={definitions:defs,
 spatialQuery:p=>({ecologyAllowed:defs.anchors.some(a=>a.id===p.anchorId),groundSupported:true,collisionFree:true,reachable:true,outsideProtectedVolumes:true,pathClear:true,budgetAllowed:true,corpseClear:true,playerDistance:200,visible:false,unsettledLootContainers:0,placementId:p.anchorId}),
 authorize:(r,q)=>q.worldId===r.worldId&&q.transactionId.startsWith('test-')&&['spawn','cast','hit','transfer'].includes(q.kind),
 materialize:i=>i.kind==='resource'?{container:cap,items:[item('copper',2),item('quartz',3)]}:{members:i.members.map((m,n)=>({actor:{realm:0,hp:'2',maxHp:'2',defense:'80'},container:cap,loot:[item('scale-'+n,3),item('dust-'+n,2)]}))}};
export function fixture(worldId){
 const d=createDirector({definitions:defs,worldId,worldSeed:'TEST-I-new-seed-709',clock:()=>0,spatialQuery:config.spatialQuery});
 d.reserveUnique({transactionId:'seed-reserve',sourceEventId:'authored',claims:[{uniqueDefinitionId:'U-test',itemInstanceId:'u-test-item',rootArtifactId:'u-test-root'}],expectedRevision:0});
 d.transitionUnique({transactionId:'seed-manifest',uniqueDefinitionId:'U-test',action:'manifest',expectedRevision:1,expectedUniqueRevision:0});
 d.transitionUnique({transactionId:'seed-claim',uniqueDefinitionId:'U-test',action:'claim',ownerId:'p1',expectedRevision:2,expectedUniqueRevision:1});
 return createRoot({worldId,director:d.serializeDirector(),combat:createCombatState({worldId,actors:[{id:'p1',realm:0,hp:'45',maxHp:'45',attack:'8'},{id:'shielded',realm:0,hp:'9',maxHp:'9',defense:'80',shields:[{id:'fraction-shield',amount:'1'}]}]}),inventory:createState({worldId,holders:['p1','p2'].map(holderId=>({holderId,safeCarryGrams:'1000'})),containers:[{...cap,containerId:'bag1',holderId:'p1'},{...cap,containerId:'bag2',holderId:'p2'},{...cap,maxSlots:0,containerId:'full',holderId:'p1'}],items:[{...item('unique-test',1),maxStack:1,itemInstanceId:'u-test-item',containerId:'bag1',uniqueDefinitionId:'U-test',rootArtifactId:'u-test-root'}]})});
}
let serial=0;
const req=(r,kind,fields={},time=r.simTime+2)=>({worldId:r.worldId,expectedRevision:r.revision,transactionId:'test-'+(++serial),simTime:time,kind,...fields});
const operation=(i,to,quantity=i.quantity)=>({kind:'transfer',itemInstanceId:i.itemInstanceId,fromContainerId:i.containerId,toContainerId:to,quantity});
const move=(r,items,to)=>req(r,'transfer',{operations:items.map(i=>operation(i,to))});
const resources=r=>r.inventory.items.filter(i=>r.inventory.containers.find(c=>c.containerId===i.containerId)?.kind==='resource');
const unique=r=>r.inventory.items.find(i=>i.uniqueDefinitionId==='U-test');
const cast=r=>req(r,'cast',{cast:{worldId:r.worldId,sourceId:'p1',castId:'test-cast',skill:{id:'independent-skill',kind:'basic',minimumRealm:0,channel:'physical',weights:['0.125','0.375','0.5'],maxTargets:3}}});
const hit=(r,targetId,segment)=>{const q=req(r,'hit');q.hit={worldId:r.worldId,castId:'test-cast',hitId:q.transactionId+'-a',targetId,segment};return q;};
export async function runIndependent(open,label){
 const evidence={label,startedAt:new Date().toISOString(),cases:[]};
 async function test(name,fn){const steps=[];let ctx;try{let mode='';const nameDB='TEST-I-R1-'+label+'-'+name+'-'+Date.now()+'-'+(++serial);let storage=await open(nameDB,stage=>mode==='abort'&&stage==='afterPut'?'abort':mode==='lost'&&stage==='afterCommit'?'loseResponse':null);const world='world-'+nameDB;await storage.initialize(fixture(world));let session=createSession({storage,...config});ctx={
 load:()=>session.load(world),session:()=>session,storage:()=>storage,mode:v=>mode=v,
 connect:()=>open(nameDB),reopen:async()=>{storage.close();storage=await open(nameDB);session=createSession({storage,...config});},
 send:async(q,options)=>{const before=await session.load(world);const result=await session.execute(q,options);const after=await session.load(world);eq(result.state,after,'returned root differs from persisted');eq(JSON.parse(JSON.stringify(after)),after,'JSON roundtrip');steps.push({request:copy(q),before,after,result});return after;},
 reject:async(q,pattern,custom=session,options)=>{const before=await session.load(world);let error;try{await custom.execute(q,options);}catch(e){error=e.message;}ok(error&&pattern.test(error),'expected rejection '+pattern+' actual '+error);const after=await session.load(world);eq(after,before,'rejection changed full root');steps.push({request:copy(q),before,after,error});},steps};
 await fn(ctx);evidence.cases.push({name,pass:true,steps,finalState:await ctx.load()});
 }catch(e){evidence.cases.push({name,pass:false,error:e.stack,steps});}finally{ctx?.storage().close();}}
 const spawn=async(x,anchorId='Z0-HERB-01',time)=>x.send(req(await x.load(),'spawn',{anchorId},time));
 await test('01-mixed-resource-last-harvest-abort-clock-generation',async x=>{
  let r=await spawn(x);eq(resources(r).map(i=>i.quantity),[2,3]);const old=r.director.anchors['Z0-HERB-01'].current.instanceId;
  r=await x.send(req(r,'transfer',{operations:[operation(resources(r)[0],'bag1',1)]},11.5));ok(r.director.anchors['Z0-HERB-01'].current.remaining===4&&!r.events.length,'partial B/C');
  const q=move(r,resources(r),'bag2');x.mode('abort');await x.reject(q,/injectedAbort/);x.mode('');r=await x.send(q);ok(r.events.length===1&&r.director.anchors['Z0-HERB-01'].current.remaining===0,'final event');eq(r.director.anchors['Z0-HERB-01'].token.createdAt,q.simTime);eq(r.receipts.at(-1).simTime,q.simTime);
  await x.reject(req(r,'spawn',{anchorId:'Z0-HERB-01'},r.simTime-0.1),/clockWentBackwards/);
  await x.reject(req(r,'spawn',{anchorId:'Z0-HERB-01'},r.simTime),/noEligiblePlan/);
  const previous=copy(r);r=await spawn(x,'Z0-HERB-01',r.director.anchors['Z0-HERB-01'].token.dueAt);
  const cur=r.director.anchors['Z0-HERB-01'].current;ok(cur.instanceId!==old&&resources(r).every(i=>i.sourceInstanceId===cur.instanceId),'actual new resource IDs');eq(r.events,previous.events);eq(r.receipts.slice(0,-1),previous.receipts);
 });
 await test('02-A-exact-alias-death-abort-stable-corpses-new-members',async x=>{
  let r=await spawn(x,'Z0-LAIR-01');const savedDrops=copy(r.drops);const members=r.drops.map(d=>d.memberId);r=await x.send(cast(r));
  for(const [n,m]of members.entries()){
   for(let segment=0;segment<3;segment++){
    const q=hit(r,m,segment), expectedA=resolveHit(copy(r.combat),q.hit);
    if(segment===2){x.mode('abort');await x.reject(q,/injectedAbort/);x.mode('');}
    r=await x.send(q);eq(r.combat,expectedA.state,'all A fields including amountExact');
    if(segment===0){eq(r.combat.casts[0].targets[n].carryExact,{numerator:'1',denominator:'3'});const before=copy(r);const alias=hit(r,m,0);r=await x.send(alias);eq(r.combat,resolveHit(before.combat,alias.hit).state,'alias new A state');ok(r.combat.hits.at(-1).aliasOf===q.hit.hitId,'alias not saved');eq(r.events,before.events);eq(r.inventory,before.inventory);eq(r.director,before.director);}
   }
   ok(r.combat.actors.find(a=>a.id===m).hp==='0'&&r.director.anchors['Z0-LAIR-01'].current.members[n].consumed,'real death A/C');eq(r.drops[n].manifest,savedDrops[n].manifest);eq(r.events.length,n+1);
   if(n===0)eq(r.director.anchors['Z0-LAIR-01'].token,null);
  }
  eq(r.director.anchors['Z0-LAIR-01'].token.createdAt,r.simTime);const loot=r.inventory.items.filter(i=>i.containerId===r.drops[0].container.containerId);
  await x.reject(move(r,loot,'full'),/slotsFull/);r=await x.send(move(r,loot,'bag1'));eq(r.drops.map(d=>d.manifest),savedDrops.map(d=>d.manifest));
  const before=copy(r);r=await spawn(x,'Z0-LAIR-01',r.director.anchors['Z0-LAIR-01'].token.dueAt);const newIds=r.director.anchors['Z0-LAIR-01'].current.members.map(m=>m.instanceId);ok(newIds.every(id=>!members.includes(id)&&r.combat.actors.some(a=>a.id===id)&&r.drops.some(d=>d.memberId===id)),'actual new member IDs');eq(r.drops.slice(0,2),before.drops);eq(r.events,before.events);
 });
 await test('03-unique-abort-and-bidirectional-owner',async x=>{let r=await x.load();const q=move(r,[unique(r)],'bag2');x.mode('abort');await x.reject(q,/injectedAbort/);x.mode('');r=await x.send(q);eq(unique(r).containerId,'bag2');eq(r.director.uniqueLedger['U-test'].ownerId,'p2');r=await x.send(move(r,[unique(r)],'bag1'));eq(r.director.uniqueLedger['U-test'].ownerId,'p1');eq(unique(r).itemInstanceId,'u-test-item');eq(unique(r).rootArtifactId,'u-test-root');eq(r.events,[]);});
 await test('04-two-independent-connections-one-CAS-winner',async x=>{const r=await spawn(x),other=await x.connect();try{const s2=createSession({storage:other,...config});const a=move(r,resources(r),'bag1'),b=move(r,resources(r),'bag2');const results=await Promise.allSettled([x.session().execute(a),s2.execute(b)]);eq(results.filter(v=>v.status==='fulfilled').length,1);const winner=results.find(v=>v.status==='fulfilled').value;const after=await x.load();eq(after,winner.state,'full root winner');eq(after.revision,r.revision+1);eq(after.events.length,1);eq(after.inventory.items.filter(i=>['copper','quartz'].includes(i.definitionId)).reduce((s,i)=>s+i.quantity,0),5);x.steps.push({before:r,after,requests:[a,b],results:results.map(v=>({status:v.status,error:v.reason?.message??null})),independentConnections:2});}finally{other.close();}});
 await test('05-response-lost-reopen-later-progress-original-replay',async x=>{let r=await spawn(x);const q=move(r,resources(r),'bag1');x.mode('lost');let error;try{await x.session().execute(q);}catch(e){error=e.message;}eq(error,'responseLost');x.mode('');await x.reopen();r=await x.load();eq(r.events.length,1);eq(r.receipts.at(-1).transactionId,q.transactionId);x.steps.push({request:q,error,after:r,closedAndReopened:true});r=await x.send(move(r,[unique(r)],'bag2'));const replay=await x.session().execute(q);eq(replay.state,r);eq(await x.load(),r);eq(replay.events,[]);ok(replay.replayed,'not replay');x.steps.push({request:q,before:r,after:await x.load(),result:replay});for(const change of [{simTime:q.simTime+1},{expectedRevision:r.revision},{operations:[operation(unique(r),'bag1')]}])await x.reject({...q,...change},/transactionIdConflict/);});
 await test('06-async-authorization-cancel-deny-throw-request-isolation',async x=>{
  const r=await x.load(),q=move(r,[unique(r)],'bag2');for(const authorize of [async()=>false,async()=>{throw Error('auth-test-error');}])await x.reject(q,/accessDenied|auth-test-error/,createSession({storage:x.storage(),...config,authorize}));
  const ctl=new AbortController();await x.reject(q,/cancelled/,createSession({storage:x.storage(),...config,authorize:async()=>{ctl.abort();return true;}}),{signal:ctl.signal});
  let release,entered;const gate=new Promise(r=>release=r),ready=new Promise(r=>entered=r);const delayed=createSession({storage:x.storage(),...config,authorize:async(state,request)=>{entered();await gate;return config.authorize(state,request);}});const pending=delayed.execute(q);await ready;q.operations[0].toContainerId='full';release();const result=await pending;eq(unique(result.state).containerId,'bag2');eq(await x.load(),result.state);x.steps.push({before:r,after:result.state,callerMutationIsolated:true});
 });
 await test('07-async-authorization-race-stale-intent-no-overwrite',async x=>{
  const r=await x.load(),q=move(r,[unique(r)],'bag2');let release,entered;const gate=new Promise(r=>release=r),ready=new Promise(r=>entered=r);const delayed=createSession({storage:x.storage(),...config,authorize:async()=>{entered();await gate;return true;}});const pending=delayed.execute(q).then(v=>({v}),e=>({error:e.message}));await ready;const after=await spawn(x);release();eq((await pending).error,'commitRejected');eq(await x.load(),after);x.steps.push({request:q,before:r,after,error:'commitRejected'});
 });
 await test('08-child-error-after-valid-B-operation-full-root-rollback',async x=>{const r=await spawn(x);const q=move(r,[unique(r)],'bag2');q.operations.push(operation(resources(r)[0],'full'));await x.reject(q,/slotsFull/);await x.reject(hit(r,'absent-target',0),/cast absent/);const forged=req(r,'event',{committed:true});await x.reject(forged,/accessDenied/);});
 await test('09-invalid-factory-and-pre-cancel-preserve-root',async x=>{const r=await x.load();for(const materialize of [undefined,async()=>({}),()=>({container:cap,items:[item('bad',1)]})])await x.reject(req(r,'spawn',{anchorId:'Z0-HERB-01'}),/materializerRequired|invalidJson|resourceCountMismatch/,createSession({storage:x.storage(),...config,materialize}));const ctl=new AbortController();ctl.abort();await x.reject(move(r,[unique(r)],'bag2'),/cancelled/,x.session(),{signal:ctl.signal});});
 await test('10-A-shield-amountExact-abort-reopen-alias',async x=>{let r=await x.send(cast(await x.load()));r=await x.send(hit(r,'shielded',0));const shield=r.combat.actors.find(a=>a.id==='shielded').shields[0];eq(shield.amountExact,{numerator:'2',denominator:'3'});eq(shield.amount,'0.66666666');const saved=copy(r);const q=hit(r,'shielded',1);x.mode('abort');await x.reject(q,/injectedAbort/);x.mode('');await x.reopen();eq(await x.load(),saved);
 const alias=hit(r,'shielded',0);r=await x.send(alias);eq(r.combat,resolveHit(saved.combat,alias.hit).state);eq(r.combat.actors.find(a=>a.id==='shielded').shields[0].amountExact,shield.amountExact);const before=copy(r);r=await x.send(hit(r,'shielded',1));eq(r.combat.casts[0].targets[0].carryExact,{numerator:'1',denominator:'3'});eq(r.combat.actors.find(a=>a.id==='shielded').shields[0].amountExact,{numerator:'0',denominator:'1'});eq(r.inventory,before.inventory);eq(r.director,before.director);eq(r.events,[]);});
 evidence.pass=evidence.cases.every(c=>c.pass);evidence.finishedAt=new Date().toISOString();return evidence;
}
