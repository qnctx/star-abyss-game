import { createSession, copy, canonical } from './index.mjs';
import { fixture, config as originalConfig, materialize, request, transfer, cast, hit } from './demo-fixture.mjs';
import { baseResource } from '../d3-combat/index.mjs';
const equal=(a,b,message='full root mismatch')=>{if(canonical(a)!==canonical(b))throw Error(message);};
const check=(ok,message)=>{if(!ok)throw Error(message);};
export const sceneConfig={playerId:'player',safePoint:{x:0,z:12,yaw:0,pitch:.2}};
const config={...originalConfig,sceneConfig,materialize:i=>{
  const spec=materialize(i); if(spec.members) for(const m of spec.members)m.actor.attack='300'; return spec;
}};
export const initialScene=time=>({version:1,time,player:{x:3,z:0,yaw:0,pitch:.2},enemies:{},pending:{},cooldowns:{},hurt:{},logs:[]});
const protectedState=r=>({inventory:r.inventory,director:r.director,drops:r.drops,events:r.events});
export async function runSceneCases(open,label) {
  const evidence={label,startedAt:new Date().toISOString(),cases:[]};let serial=0;
  async function group(name,fn) {
    let storage;const steps=[];
    try {
      let mode='';const dbName=`DEV-I-R2-${label}-${name}-${Date.now()}-${++serial}`;
      const fault=stage=>mode==='abort'&&stage==='afterPut'?'abort':mode==='lost'&&stage==='afterCommit'?'loseResponse':null;
      storage=await open(dbName,fault);const worldId=dbName;await storage.initialize(fixture(worldId));
      let session=createSession({storage,...config});
      const x={load:()=>session.load(worldId),session:()=>session,storage:()=>storage,mode:v=>mode=v,
        reopen:async()=>{storage.close();storage=await open(dbName,fault);session=createSession({storage,...config});},
        send:async q=>{const before=await x.load();const result=await session.execute(q);const after=await x.load();equal(result.state,after);steps.push({request:q,before,after});return after;},
        reject:async(q,pattern,custom=session)=>{const before=await x.load();let error;try{await custom.execute(q);}catch(e){error=e.message;}
          check(error&&pattern.test(error),`expected ${pattern}, got ${error}`);equal(await x.load(),before);steps.push({request:q,error,before,after:await x.load()});},
        q:(r,kind,fields={})=>request(r,`${name}-${++serial}`,kind,fields),steps};
      await fn(x);evidence.cases.push({name,pass:true,steps,finalState:await x.load()});
    }catch(e){evidence.cases.push({name,pass:false,error:e.stack,steps});}finally{storage?.close();}
  }
  const checkpoint=async x=>{const r=await x.load();return x.send(x.q(r,'checkpoint',{scene:initialScene(r.simTime+1)}));};
  const defeat=async x=>{
    await checkpoint(x);let r=await x.load();
    r=await x.send(x.q(r,'spawn',{anchorId:'Z0-HERB-01'}));
    r=await x.send(transfer(r,`harvest-${++serial}`,r.inventory.items.find(i=>i.definitionId==='herb'),'pack'));
    r=await x.send(x.q(r,'spawn',{anchorId:'Z0-LAIR-01'}));
    const first=r.drops[0].memberId, attacker=r.drops[1].memberId;
    // A real corpse + committed death event must survive the later player rescue.
    r=await x.send(cast(r));for(let n=0;n<3;n++)r=await x.send(hit(r,first,n));
    let scene=copy(r.scene);scene.time=r.simTime+1;
    scene.enemies={[first]:{x:1,z:-10,yaw:0},[attacker]:{x:4,z:-8,yaw:Math.PI}};
    r=await x.send(x.q(r,'checkpoint',{scene}));
    const q=x.q(r,'cast',{cast:{worldId:r.worldId,sourceId:attacker,castId:'enemy-fatal',skill:{id:'bite',kind:'basic',minimumRealm:0,channel:'physical',weights:['0.5','0.5']}}});
    scene=copy(r.scene);scene.time=q.simTime;
    scene.pending[attacker]={castId:'enemy-fatal',start:q.simTime,due:q.simTime+.8,end:q.simTime+1.2,yaw:Math.PI,committed:false,resolved:false};
    scene.cooldowns[attacker]=q.simTime+2.5;scene.hurt.player=q.simTime+.3;q.scene=scene;r=await x.send(q);
    r=await x.send(x.q(r,'hit',{hit:{worldId:r.worldId,castId:'enemy-fatal',hitId:'fatal-hit',targetId:'player',segment:0}}));
    check(r.combat.actors.find(a=>a.id==='player').hp==='0','A did not defeat player');return r;
  };
  await group('01-checkpoint-whitelist-bounds-legacy',async x=>{
    const old=await x.load();check(!Object.hasOwn(old,'scene'),'legacy field unexpectedly added');
    let r=await checkpoint(x);equal(protectedState(r),protectedState(old));equal(r.combat,old.combat);check(r.scene.time===r.simTime,'clock mismatch');
    const mutations=[s=>s.inventory={},s=>s.player.hp=999,s=>s.player.x=Infinity,s=>s.player.z=-49,s=>s.player.yaw=10,
      s=>s.enemies.unknown={x:0,z:0,yaw:0},s=>s.logs=Array.from({length:31},()=>({time:0,text:'x'})),
      s=>s.logs=[{time:0,text:'x'.repeat(201)}],s=>s.pending.player={castId:'absent',start:0,due:1,end:2,yaw:0,committed:true,resolved:false}];
    for(const mutate of mutations){const scene=copy(r.scene);scene.time=r.simTime+1;mutate(scene);await x.reject(x.q(r,'checkpoint',{scene}),/invalid/);}
    const q=x.q(r,'checkpoint',{scene:{...r.scene,time:r.simTime+1},combat:r.combat});await x.reject(q,/invalidSceneFields/);
    equal(await x.load(),r);
  });
  await group('02-business-scene-atomic-and-checkpoint-abort',async x=>{
    let r=await checkpoint(x);const q=cast(r,'scene-cast');q.scene=copy(r.scene);q.scene.time=q.simTime;
    q.scene.pending.player={castId:'scene-cast',start:q.simTime,due:q.simTime+.35,end:q.simTime+.75,yaw:0,committed:false,resolved:false};
    x.mode('abort');await x.reject(q,/injectedAbort/);x.mode('');r=await x.send(q);
    check(r.scene.pending.player.castId===r.combat.casts[0].castId,'cast/scene mismatch');
    const c=x.q(r,'checkpoint',{scene:{...r.scene,time:r.simTime+1,player:{...r.scene.player,x:7}}});
    x.mode('abort');await x.reject(c,/injectedAbort/);x.mode('');r=await x.send(c);
    const bad=cast(r,'bad-scene-cast');bad.scene={...r.scene,time:bad.simTime,combat:{}};await x.reject(bad,/invalidSceneFields/);
  });
  await group('03-rescue-reject-live-missing-config-payload',async x=>{
    let r=await checkpoint(x);await x.reject(x.q(r,'rescue'),/playerNotDefeated/);
    const noConfig=createSession({storage:x.storage(),...originalConfig});await x.reject(x.q(r,'rescue'),/sceneConfigurationRequired/,noConfig);
    for(const fields of [{playerId:'another'},{hp:'100'},{scene:r.scene},{safePoint:{x:1,z:1}}])await x.reject(x.q(r,'rescue',fields),/invalidSceneFields/);
    const badConfigs=[{...sceneConfig,safePoint:{...sceneConfig.safePoint,x:99}},{...sceneConfig,restoreHp:'999'}];
    for(const c of badConfigs){let error;try{createSession({storage:x.storage(),...originalConfig,sceneConfig:c});}catch(e){error=e;}check(error,'bad config accepted');}
  });
  await group('04-real-defeat-rescue-preserves-all-assets-and-stops-old-casts',async x=>{
    const before=await defeat(x),q=x.q(before,'rescue');const r=await x.send(q);
    equal(protectedState(r),protectedState(before));equal(r.receipts.slice(0,-1),before.receipts);
    const oldPlayer=before.combat.actors.find(a=>a.id==='player'),player=r.combat.actors.find(a=>a.id==='player');
    equal(player,{...oldPlayer,hp:oldPlayer.maxHp,resource:baseResource(oldPlayer.realm,oldPlayer.level)});
    equal(r.combat.actors.filter(a=>a.id!=='player'),before.combat.actors.filter(a=>a.id!=='player'));
    equal(r.combat.hits,before.combat.hits);equal(r.scene.enemies,before.scene.enemies);equal(r.scene.player,sceneConfig.safePoint);
    equal(r.scene.pending,{});equal(r.scene.cooldowns,{});equal(r.scene.hurt,{});check(r.combat.casts.every(c=>c.interrupted),'old casts active');
    await x.reject(x.q(r,'hit',{hit:{worldId:r.worldId,castId:'enemy-fatal',hitId:'late-segment',targetId:'player',segment:1}}),/interrupted/);
    const replay=await x.session().execute(q);check(replay.replayed&&replay.events.length===0,'rescue replay');equal(replay.state,r);
  });
  await group('05-rescue-abort-lost-response-reopen-latest-retry',async x=>{
    const before=await defeat(x),q=x.q(before,'rescue');x.mode('abort');await x.reject(q,/injectedAbort/);x.mode('lost');
    let error;try{await x.session().execute(q);}catch(e){error=e.message;}check(error==='responseLost','expected lost');x.mode('');await x.reopen();
    const committed=await x.load();check(committed.combat.actors.find(a=>a.id==='player').hp==='100','rescue not saved');
    const c=x.q(committed,'checkpoint',{scene:{...committed.scene,time:committed.simTime+1,player:{...committed.scene.player,x:8}}});
    const latest=await x.send(c);equal((await x.session().execute(q)).state,latest);equal(await x.load(),latest);
    x.steps.push({request:q,before,after:latest,closedAndReopened:true,error});
  });
  await group('06-async-rescue-authorization-concurrency-cannot-overwrite',async x=>{
    const r=await defeat(x),q=x.q(r,'rescue');let entered,release;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
    const delayed=createSession({storage:x.storage(),...config,authorize:async()=>{entered();await gate;return true;}});
    const pending=delayed.execute(q).then(()=>null,e=>e.message);await ready;
    const winner=await x.send(x.q(r,'checkpoint',{scene:{...r.scene,time:r.simTime+1,player:{...r.scene.player,x:9}}}));
    release();check(await pending==='commitRejected','stale rescue accepted');equal(await x.load(),winner);
    await x.reject(x.q(winner,'rescue'),/accessDenied/,createSession({storage:x.storage(),...config,authorize:async()=>false}));
    const ctl=new AbortController();const cancelled=createSession({storage:x.storage(),...config,authorize:async()=>{ctl.abort();return true;}});
    const before=await x.load();let error;try{await cancelled.execute(x.q(before,'rescue'),{signal:ctl.signal});}catch(e){error=e.message;}
    check(error==='cancelled','not cancelled');equal(await x.load(),before);
  });
  await group('07-checkpoint-lost-response-and-config-snapshot',async x=>{
    const r=await x.load(),q=x.q(r,'checkpoint',{scene:initialScene(r.simTime+1)});
    x.mode('lost');let error;try{await x.session().execute(q);}catch(e){error=e.message;}check(error==='responseLost','checkpoint response');x.mode('');await x.reopen();
    const committed=await x.load();const replay=await x.session().execute(q);check(replay.replayed,'checkpoint duplicated');equal(replay.state,committed);
    const c=copy(sceneConfig);const s=createSession({storage:x.storage(),...originalConfig,sceneConfig:c});c.playerId='missing';c.safePoint.x=999;
    const next=x.q(committed,'checkpoint',{scene:{...committed.scene,time:committed.simTime+1}});await s.execute(next);
    check((await x.load()).revision===committed.revision+1,'config was not copied');
  });
  evidence.pass=evidence.cases.every(c=>c.pass);evidence.finishedAt=new Date().toISOString();return evidence;
}
