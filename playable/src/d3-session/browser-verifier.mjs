import { openIndexedDB } from './indexeddb.mjs';
import { createSession, canonical } from './index.mjs';
import { fixture, config, request, transfer, cast, hit } from './demo-fixture.mjs';
const $ = id => document.getElementById(id);
let db, session, root;
const lines = [];
const log = text => { lines.push(text); $('log').textContent = lines.join('\n'); };
const check = (ok, message) => { if (!ok) throw Error(message); };
const equal = (a,b,message) => check(canonical(a) === canonical(b), message);
async function rejects(fn, pattern) { try { await fn(); } catch(e) { check(pattern.test(e.message), e.message); return e.message; } throw Error('Expected rejection'); }
async function connect() { db ??= await openIndexedDB({ name: 'DEV-I-manual-v1' }); session = createSession({ storage: db, ...config }); await db.initialize(fixture()); root = await session.load('DEV-I-local'); }
async function show() { if (session) { root = await session.load('DEV-I-local'); $('state').textContent = JSON.stringify(root,null,2); } }
async function send(req) { const result = await session.execute(req); root = result.state; log(`${req.kind}: root revision ${root.revision}; events ${result.events.length}`); }
const nextId = kind => `${kind}-${root.revision}`;
const spawn = async anchorId => send(request(root,nextId('spawn'),'spawn',{anchorId}));
async function killOne() {
  if (!root.director.anchors['Z0-LAIR-01'].current) await spawn('Z0-LAIR-01');
  const member = root.director.anchors['Z0-LAIR-01'].current.members.find(m => !m.consumed);
  check(member, '本代怪群已经全部击败'); const castId = nextId('cast'); await send(cast(root,castId));
  for(let n=0;n<3;n++) await send(hit(root,member.instanceId,n,nextId('hit'),castId));
}
async function runSuite() {
  const evidence = { version: 'DEV-I-R1', userAgent: navigator.userAgent, startedAt: new Date().toISOString(), cases: [] };
  const name = 'DEV-I-suite-v1'; let mode = '';
  const fault = stage => mode === 'abort' && stage === 'afterPut' ? 'abort' : mode === 'lost' && stage === 'afterCommit' ? 'loseResponse' : null;
  let storage = await openIndexedDB({ name, fault });
  const other = await openIndexedDB({name});
  const world = `suite-${Date.now()}-${crypto.randomUUID()}`;
  let s = createSession({storage,...config});
  const load = () => s.load(world);
  const record = async (name, fn) => { const before = await load(); const details = await fn(); const after = await load(); evidence.cases.push({name,pass:true,details:details ?? null,before,after}); log('PASS '+name); };
  try {
    check(await storage.initialize(fixture(world)), 'initialize failed');
    await record('真实资源生成、部分采收、满包回滚', async () => {
      let r = await load(); await s.execute(request(r,'spawn','spawn',{anchorId:'Z0-HERB-01'})); r = await load();
      let i = r.inventory.items.find(i=>i.definitionId==='herb'); const count=i.quantity;
      await s.execute(transfer(r,'partial',i,'pack',1)); r=await load();
      check(r.director.anchors['Z0-HERB-01'].current.remaining===count-1,'partial mismatch');
      i=r.inventory.items.find(j=>j.containerId===i.containerId);
      const error=await rejects(()=>s.execute(transfer(r,'full',i,'full-pack')),/slotsFull/); equal(await load(),r,'full changed root'); return {error};
    });
    await record('真实 IDB put 成功后 abort，整根回滚',async()=>{
      const r=await load(), i=r.inventory.items.find(i=>i.containerId.startsWith('["session","resource",'));
      const req=transfer(r,'abort',i,'pack'); mode='abort'; const error=await rejects(()=>s.execute(req),/injectedAbort/); mode='';
      equal(await load(),r,'abort changed root'); return {error,request:req};
    });
    await record('两个独立 IDB 连接并发 CAS，只有一个采收成功',async()=>{
      const r=await load(), i=r.inventory.items.find(i=>i.containerId.startsWith('["session","resource",'));
      const s2=createSession({storage:other,...config});
      const results=await Promise.allSettled([s.execute(transfer(r,'race-a',i,'pack')),s2.execute(transfer(r,'race-b',i,'other-pack'))]);
      check(results.filter(r=>r.status==='fulfilled').length===1,'race winners');
      const after=await load(); check(after.events.length===1 && after.director.anchors['Z0-HERB-01'].token,'race event missing');
      check(after.inventory.items.filter(j=>j.definitionId==='herb').reduce((n,j)=>n+j.quantity,0)===r.inventory.items.filter(j=>j.definitionId==='herb').reduce((n,j)=>n+j.quantity,0),'race duplicated');
      return results.map(r=>({status:r.status,error:r.reason?.message ?? null}));
    });
    await record('唯一物提交成功但响应丢失；关闭连接重载原请求不复制',async()=>{
      const r=await load(), req=transfer(r,'lost',r.inventory.items.find(i=>i.uniqueDefinitionId),'other-pack');
      mode='abort'; await rejects(()=>s.execute(req),/injectedAbort/); mode=''; equal(await load(),r,'unique abort split owner');
      mode='lost'; await rejects(()=>s.execute(req),/responseLost/); mode=''; storage.close();
      storage=await openIndexedDB({name,fault}); s=createSession({storage,...config}); const committed=await load();
      const retry=await s.execute(req); check(retry.replayed&&retry.events.length===0,'retry emitted'); equal(retry.state,committed,'retry overwrote');
      check(committed.director.uniqueLedger['MYW-demo'].ownerId==='other','owner not moved');
      return {request:req,replayed:retry.replayed,closedAndReopened:true};
    });
    await record('A 精确余数、真实死亡一次、满包尸体保留与别名保存',async()=>{
      await s.execute(request(await load(),'monsters','spawn',{anchorId:'Z0-LAIR-01'}));
      let r=await load(); const member=r.drops[0].memberId; await s.execute(cast(r));
      for(let n=0;n<3;n++) {
        const before=await load(), req=hit(before,member,n);
        if(n===2) {mode='abort';await rejects(()=>s.execute(req),/injectedAbort/);mode='';equal(await load(),before,'death abort changed root');}
        await s.execute(req); if(n===0) equal((await load()).combat.casts[0].targets[0].carryExact,{numerator:'1',denominator:'3'},'exact lost');
      }
      r=await load(); check(r.combat.actors.find(a=>a.id===member).hp==='0','not dead');
      check(r.events.filter(e=>e.kind==='defeatCommitted').length===1,'death events');
      const loot=r.inventory.items.find(i=>i.definitionId==='monster-material');
      await rejects(()=>s.execute(transfer(r,'full-loot',loot,'full-pack')),/slotsFull/); equal(await load(),r,'corpse lost');
      await s.execute(hit(r,member,2,'alias')); check((await load()).combat.hits.at(-1).aliasOf==='hit-2','alias lost');
      await s.execute(transfer(await load(),'pickup',loot,'pack'));
      check((await load()).drops[0].created,'manifest missing'); return {member,lootId:loot.itemInstanceId};
    });
    await record('已取消请求无写入',async()=>{
      const r=await load(), controller=new AbortController(); controller.abort();
      await rejects(()=>s.execute(transfer(r,'cancel',r.inventory.items.find(i=>i.uniqueDefinitionId),'pack'),{signal:controller.signal}),/cancelled/);
      equal(await load(),r,'cancel changed root');
    });
    evidence.pass=true; evidence.finalState=await load(); evidence.finishedAt=new Date().toISOString();
    const response=await fetch('./evidence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(evidence,null,2)});
    log(response.ok ? '完整前后快照证据已写入 d3-session/browser-evidence.json' : '证据写入不可用，页面日志仍可检查');
    $('state').textContent=JSON.stringify(evidence,null,2); $('status').textContent=`真实 IDB 套件通过 ${evidence.cases.length}/${evidence.cases.length}；可刷新页面后初始化 / 重载手动存档。`;
  } catch(error) { evidence.pass=false; evidence.error=error.stack; log('FAIL '+error.stack); throw error; }
  finally { storage.close(); other.close(); }
}
const handlers={load:connect,spawn:async()=>{await connect();await spawn('Z0-HERB-01');},harvest:async()=>{
  await connect(); const i=root.inventory.items.find(i=>root.inventory.containers.find(c=>c.containerId===i.containerId)?.kind==='resource');
  check(i,'没有可采资源'); await send(transfer(root,nextId('harvest'),i,'pack',1));
},kill:async()=>{await connect();await killOne();},pickup:async()=>{await connect();const i=root.inventory.items.find(i=>i.definitionId==='monster-material'&&i.containerId.startsWith('["session","corpse",'));check(i,'没有待拾取清单');await send(transfer(root,nextId('pickup'),i,'pack'));},unique:async()=>{
  await connect();const i=root.inventory.items.find(i=>i.uniqueDefinitionId);await send(transfer(root,nextId('unique'),i,i.containerId==='pack'?'other-pack':'pack'));
},suite:runSuite};
for(const [id,handler] of Object.entries(handlers)) $(id).onclick=async()=>{
  document.querySelectorAll('button').forEach(b=>b.disabled=true);$('status').textContent='正在执行真实根事务…';
  try{await handler();if(id!=='suite'){$('status').textContent='完成；显示数据库重载结果。';await show();}}
  catch(e){log('拒绝：'+e.message);$('status').textContent='操作失败：'+e.message;await show();}
  finally{document.querySelectorAll('button').forEach(b=>b.disabled=false);}
};
