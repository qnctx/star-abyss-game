import {createSession,copy,canonical,validateRoot,validateSceneConfig} from '../index.mjs';
import {fixture,config as oldConfig,materialize,request,transfer,cast,hit} from '../demo-fixture.mjs';
import {initialScene} from '../scene-cases-r2.mjs';
export const worldConfig={playerId:'player',safePoint:{x:0,z:190,yaw:0,pitch:0},poseBounds:{xMin:-3000,xMax:3000,zMin:-3000,zMax:3000,pitchMin:-1.35,pitchMax:1.35}};
export const config={...oldConfig,sceneConfig:worldConfig,materialize:i=>{const s=materialize(i);if(s.members)for(const m of s.members)Object.assign(m.actor,{hp:'10',maxHp:'10',attack:'300'});return s;}};
const eq=(a,b)=>{if(canonical(a)!==canonical(b))throw Error('Full snapshot mismatch');};
const ok=(v,m)=>{if(!v)throw Error(m);};
const raises=fn=>{let error;try{fn();}catch(e){error=e;}ok(error,'Expected rejection');};
export async function runBoundsCases(open,label){
 const evidence={label,cases:[],startedAt:new Date().toISOString()};let seq=0;
 async function group(name,fn){let storage;const steps=[];try{
  let mode='';const dbName=`DEV-I-R3-${label}-${name}-${Date.now()}-${++seq}`,worldId=dbName;
  storage=await open(dbName,stage=>mode==='abort'&&stage==='afterPut'?'abort':mode==='lost'&&stage==='afterCommit'?'loseResponse':null,worldConfig);
  await storage.initialize(fixture(worldId));let session=createSession({storage,...config});
  const x={storage:()=>storage,session:()=>session,load:()=>session.load(worldId),mode:v=>mode=v,q:(r,kind,fields={})=>request(r,`${name}-${++seq}`,kind,fields),
   send:async q=>{const before=await x.load(),result=await session.execute(q),after=await x.load();eq(result.state,after);steps.push({before,request:q,after});return after;},
   reject:async q=>{const before=await x.load();let error;try{await session.execute(q);}catch(e){error=e.message;}ok(error,'Expected rejection');eq(await x.load(),before);steps.push({request:q,error,before,after:await x.load()});},
   reopen:async()=>{storage.close();storage=await open(dbName,()=>null,worldConfig);session=createSession({storage,...config});}};
  await fn(x);const finalState=await x.load();evidence.cases.push({name,pass:true,steps,finalState});
  evidence.reload={name:dbName,worldId,sceneConfig:worldConfig,expected:finalState};
 }catch(e){evidence.cases.push({name,pass:false,error:e.stack,steps});}finally{storage?.close();}}
 const save=async(x,player)=>{const r=await x.load(),scene=r.scene?copy(r.scene):initialScene(r.simTime+1);scene.time=r.simTime+1;scene.player={...player};return x.send(x.q(r,'checkpoint',{scene}));};
 await group('01-config-and-original-world-edges',async x=>{
  for(const b of [{xMin:3000},{xMin:NaN},{xMax:Infinity},{pitchMax:2},{pitchMin:1.35},{extra:1}])raises(()=>validateSceneConfig({...worldConfig,poseBounds:{...worldConfig.poseBounds,...b}}));
  raises(()=>validateSceneConfig({...worldConfig,safePoint:{...worldConfig.safePoint,z:3000}}));
  for(const p of [{x:2999.58,z:-2999.58,yaw:Math.PI,pitch:1.35},{x:-2999.58,z:2999.58,yaw:-Math.PI,pitch:-1.35},{x:0,z:190,yaw:0,pitch:0}])await save(x,p);
  const r=await x.load();validateRoot(r,worldConfig);raises(()=>validateRoot(r));
  for(const p of [{x:3000},{x:-3000},{z:-3000},{z:3000},{pitch:1.350001},{yaw:Math.PI+.001}]){
   const scene={...r.scene,time:r.simTime+1,player:{...r.scene.player,...p}};await x.reject(x.q(r,'checkpoint',{scene}));
  }
  await x.reject(x.q(r,'checkpoint',{scene:{...r.scene,time:r.simTime+1,poseBounds:worldConfig.poseBounds}}));
  await x.reject(x.q(r,'rescue',{sceneConfig:worldConfig}));
 });
 await group('02-business-scenes-and-enemy-world-coordinates',async x=>{
  let r=await save(x,worldConfig.safePoint);r=await x.send(x.q(r,'spawn',{anchorId:'Z0-LAIR-01',scene:{...r.scene,time:r.simTime+1}}));
  const enemy=r.drops[0].memberId,scene={...r.scene,time:r.simTime+1,enemies:{[enemy]:{x:-2500,z:2700,yaw:1}}};r=await x.send(x.q(r,'checkpoint',{scene}));
  const c=cast(r);c.scene={...r.scene,time:c.simTime,player:{x:2400,z:1900,yaw:0,pitch:-1.35}};r=await x.send(c);
  const h=hit(r,enemy,0);h.scene={...r.scene,time:h.simTime};r=await x.send(h);
  ok(r.combat.actors.find(a=>a.id===enemy).hp==='10','fraction hit should retain HP');
  const t=transfer(r,'unique-move',r.inventory.items.find(i=>i.uniqueDefinitionId),'other-pack');t.scene={...r.scene,time:t.simTime};r=await x.send(t);
  const invalid=cast(r,'invalid-enemy');invalid.scene={...r.scene,time:invalid.simTime,enemies:{[enemy]:{x:3000,z:0,yaw:0}}};await x.reject(invalid);
 });
 await group('03-checkpoint-abort-lost-reload-latest-request',async x=>{
  let r=await save(x,worldConfig.safePoint);const q=x.q(r,'checkpoint',{scene:{...r.scene,time:r.simTime+1,player:{x:-1900,z:2300,yaw:0,pitch:1.35}}});
  x.mode('abort');await x.reject(q);x.mode('lost');let error;try{await x.session().execute(q);}catch(e){error=e.message;}ok(error==='responseLost','Expected response loss');x.mode('');await x.reopen();
  r=await x.load();ok(r.scene.player.x===-1900,'Large coordinates not saved');r=await save(x,{x:1800,z:-2400,yaw:0,pitch:-1.35});eq((await x.session().execute(q)).state,r);
 });
 await group('04-config-copy-and-adapter-session-mismatch',async x=>{
  const r=await save(x,worldConfig.safePoint);
  const changed=copy(worldConfig);changed.safePoint.z=191;
  raises(()=>createSession({storage:x.storage(),...config,sceneConfig:changed}));
  raises(()=>createSession({storage:x.storage(),...oldConfig}));
  const c=copy(worldConfig),s=createSession({storage:x.storage(),...config,sceneConfig:c});c.poseBounds.zMax=10;c.safePoint.z=1;
  const q=x.q(r,'checkpoint',{scene:{...r.scene,time:r.simTime+1,player:{x:0,z:2500,yaw:0,pitch:1.35}}});await s.execute(q);
  eq((await x.load()).scene,q.scene);
 });
 await group('05-real-defeat-rescue-large-map-retains-enemy-injury',async x=>{
  let r=await save(x,{x:-2300,z:2800,yaw:0,pitch:1.35});r=await x.send(x.q(r,'spawn',{anchorId:'Z0-LAIR-01'}));const enemy=r.drops[0].memberId;
  r=await x.send(cast(r));for(let n=0;n<3;n++)r=await x.send(hit(r,enemy,n));
  const enemyHp=r.combat.actors.find(a=>a.id===enemy).hp;ok(enemyHp!=='10'&&enemyHp!=='0','Enemy must be injured alive');
  r=await x.send(x.q(r,'cast',{cast:{worldId:r.worldId,sourceId:enemy,castId:'fatal',skill:{id:'bite',kind:'basic',minimumRealm:0,channel:'physical'}}}));
  r=await x.send(x.q(r,'hit',{hit:{worldId:r.worldId,castId:'fatal',hitId:'fatal-hit',targetId:'player',segment:0}}));
  ok(r.combat.actors.find(a=>a.id==='player').hp==='0','Real A death required');const before=copy(r),q=x.q(r,'rescue');
  x.mode('abort');await x.reject(q);x.mode('');r=await x.send(q);eq(r.scene.player,worldConfig.safePoint);
  for(const f of ['inventory','director','drops','events'])eq(r[f],before[f]);eq(r.receipts.slice(0,-1),before.receipts);
  ok(r.combat.actors.find(a=>a.id===enemy).hp===enemyHp,'Enemy healed');ok(r.combat.casts.every(c=>c.interrupted),'Old cast not stopped');
  await x.reopen();eq(await x.load(),r);eq((await x.session().execute(q)).state,r);
 });
 evidence.pass=evidence.cases.every(c=>c.pass);evidence.finishedAt=new Date().toISOString();return evidence;
}
