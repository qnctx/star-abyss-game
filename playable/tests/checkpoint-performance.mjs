import {createSession,validateRoot} from '../src/d3-session/index.mjs';
import {openIndexedDB} from '../src/d3-session/indexeddb.mjs';
import {rulesFor,initialRoot} from '../src/expedition-runtime/rules.mjs';
import {sceneConfigFor} from '../src/expedition-runtime/index.mjs';
import {definitions} from '../src/expedition-world/definitions.mjs';
import {createCheckpointClient} from '../src/performance/checkpoint-client.mjs';
const stats=a=>{a.sort((x,y)=>x-y);return {count:a.length,p50:a[Math.floor(a.length*.5)]||0,p95:a[Math.floor(a.length*.95)]||0,p99:a[Math.floor(a.length*.99)]||0,max:a.at(-1)||0,over33:a.filter(x=>x>33).length,over50:a.filter(x=>x>50).length};};
window.runCheckpointBenchmark=async()=>{
 const rules=rulesFor(definitions),sceneConfig=sceneConfigFor('perf-player'),results={};
 for(const mode of ['main','worker']){
  const name='star-abyss-performance-isolated-'+mode+'-'+crypto.randomUUID(),link={worldId:'perf-world',playerId:'perf-player'};
  const storage=await openIndexedDB({name,sceneConfig}),root=initialRoot(link,rules,()=>({collisionFree:false,corpseClear:true,budgetAllowed:true,visible:false,playerDistance:1000}));
  const scene={version:1,time:0,player:{x:0,z:190,yaw:0,pitch:0},enemies:{},pending:{},cooldowns:{},hurt:{},logs:[]};
  root.scene=scene;
  // 30 minutes of 2-second checkpoints, using the real receipt schema and real
  // complete root validation. No production database is opened.
  root.revision=900;root.receipts=Array.from({length:900},(_,i)=>({transactionId:'historical-'+i,revision:i+1,simTime:0,eventIds:[],signature:JSON.stringify({kind:'checkpoint',scene,transactionId:'historical-'+i})}));
  validateRoot(root,sceneConfig);await storage.initialize({...root,revision:0,receipts:[]});
  // Initialization API correctly rejects nonzero revisions. Populate history by
  // one explicit fixture transaction in this disposable test database.
  await new Promise((resolve,reject)=>{const q=indexedDB.open(name);q.onsuccess=()=>{const db=q.result,tx=db.transaction('roots','readwrite');tx.objectStore('roots').put(root);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
  const client=mode==='worker'?await createCheckpointClient({name,sceneConfig,definitions:rules.definitions},{url:new URL('../checkpoint-worker.js',document.baseURI)}):null;
  if(mode==='worker'&&!client)throw Error('Worker failed to start');
  const session=client??createSession({storage,definitions:rules.definitions,sceneConfig,spatialQuery:()=>{throw Error('unexpectedQuery');},authorize:()=>true});
  const frames=[],durations=[];let running=true,last=performance.now();
  const sample=now=>{frames.push(now-last);last=now;if(running)requestAnimationFrame(sample);};requestAnimationFrame(sample);
  let revision=900;
  for(let i=0;i<20;i++){
   await new Promise(resolve=>setTimeout(resolve,30));const start=performance.now();
   const request={kind:'checkpoint',worldId:link.worldId,transactionId:'new-'+i,expectedRevision:revision,simTime:i,scene:{...scene,time:i}};
   const value=await session.execute(request);revision=value.state.revision;durations.push(performance.now()-start);
  }
  // Revision CAS, durable reload and idempotent replay retain identical semantics.
  const lastRequest={kind:'checkpoint',worldId:link.worldId,transactionId:'new-19',expectedRevision:919,simTime:19,scene:{...scene,time:19}};
  const replay=await session.execute(lastRequest);if(!replay.replayed||replay.state.revision!==920)throw Error('Replay failed');
  let conflict=false;try{await session.execute({...lastRequest,transactionId:'stale'});}catch{conflict=true;}if(!conflict)throw Error('CAS failed');
  const saved=await storage.load(link.worldId);if(saved.revision!==920||saved.receipts.length!==920)throw Error('Durability failed');
  running=false;await new Promise(resolve=>setTimeout(resolve,40));results[mode]={raf:stats(frames),transactionMs:stats(durations),revision:saved.revision,receipts:saved.receipts.length};
  client?.close();storage.close();await new Promise(resolve=>{const req=indexedDB.deleteDatabase(name);req.onsuccess=resolve;req.onerror=resolve;});
 }
 return results;
};
