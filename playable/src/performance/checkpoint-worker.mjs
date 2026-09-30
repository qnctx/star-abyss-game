import {createSession} from '../d3-session/index.mjs';
import {openIndexedDB} from '../d3-session/indexeddb.mjs';
let storage,session;
self.onmessage=async({data})=>{
 const {id,kind}=data;
 try{
  if(kind==='init'){
   storage=await openIndexedDB({name:data.name,sceneConfig:data.sceneConfig});
   session=createSession({storage,definitions:data.definitions,sceneConfig:data.sceneConfig,
    spatialQuery:()=>{throw Error('checkpointCannotQueryWorld');},authorize:(_root,request)=>request.kind==='checkpoint'});
   self.postMessage({id,result:true});
  }else if(kind==='checkpoint'){
   if(!session||data.request.kind!=='checkpoint')throw Error('checkpointOnly');
   // Same authoritative reload, revision CAS, validation and receipts as the
   // main session. Combat/inventory mutations never enter this worker.
   const result=await session.execute(data.request);
   self.postMessage({id,result});
  }else throw Error('checkpointOnly');
 }catch(error){self.postMessage({id,error:String(error.code||error.message)});}
};
