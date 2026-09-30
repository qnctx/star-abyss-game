// Failure to start falls back before any write. Once dispatched, failures must
// reach the normal authoritative reload path; never replay an uncertain write.
export async function createCheckpointClient(config,{WorkerClass=globalThis.Worker,url=new URL('checkpoint-worker.js',globalThis.document?.baseURI??'http://localhost/')}={}){
 if(!WorkerClass)return null;
 let worker;try{worker=new WorkerClass(url);}catch{return null;}
 const pending=new Map();let serial=0,closed=false;
 const fail=message=>{for(const {reject}of pending.values())reject(Error(message));pending.clear();};
 worker.onmessage=({data})=>{const promise=pending.get(data.id);if(!promise)return;pending.delete(data.id);data.error?promise.reject(Error(data.error)):promise.resolve(data.result);};
 worker.onerror=()=>{closed=true;fail('checkpointWorkerFailed');worker.terminate();};
 const send=(kind,data)=>new Promise((resolve,reject)=>{if(closed){reject(Error('checkpointWorkerClosed'));return;}const id=++serial;pending.set(id,{resolve,reject});try{worker.postMessage({id,kind,...data});}catch(error){pending.delete(id);reject(error);}});
 const close=()=>{closed=true;fail('checkpointWorkerClosed');worker.terminate();};
 let timer;
 try{await Promise.race([send('init',config),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('checkpointWorkerTimeout')),5000);})]);}
 catch{close();return null;}finally{clearTimeout(timer);}
 return {execute:request=>send('checkpoint',{request}),close};
}
