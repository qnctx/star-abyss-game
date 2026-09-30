import {createState,planTransaction,commitTransaction} from '../d3-inventory/index.mjs';
import {definitionFor,DESTINATIONS} from './catalog.mjs';

const check=(condition,message)=>{if(!condition)throw Error(message);};
export const EXPLORATION_VERSION=1;
const specs={'meteor-iron':{unitVolumeMl:'400',unitMassGrams:'2000'},'moon-moss':{unitVolumeMl:'200',unitMassGrams:'100'}};
export const supplyId=id=>'exploration-supply:'+id;
export function explorationState(root){return root.exploration||{version:1,sites:{},returned:[]};}
export function validateExploration(root){
 const state=root.exploration;if(!state)return true;
 check(state.version===1&&state.sites&&Array.isArray(state.returned),'invalidExploration');
 check(new Set(state.returned).size===state.returned.length,'invalidExploration');
 for(const [id,record] of Object.entries(state.sites)){
  const def=definitionFor(id);check(def&&Number.isFinite(record.discoveredAt)&&record.discoveredAt>=0&&record.discoveredAt<=root.simTime,'invalidExploration');
  check(record.investigatedAt===null||Number.isFinite(record.investigatedAt)&&record.investigatedAt>=record.discoveredAt&&record.investigatedAt<=root.simTime,'invalidExploration');
  check(Number.isInteger(record.collected)&&record.collected>=0&&record.collected<=(def.quantity||0),'invalidExploration');
  if(record.investigatedAt!==null&&def.quantity){
   const con=root.inventory.containers.find(c=>c.containerId===supplyId(id));
   const stock=root.inventory.items.filter(i=>i.containerId===supplyId(id));
   check(con?.kind==='ground'&&stock.every(i=>i.definitionId===def.itemId)&&stock.reduce((n,i)=>n+i.quantity,0)+record.collected===def.quantity,'explorationStockMismatch');
  }else check(record.collected===0,'invalidExploration');
 }
 check(state.returned.every(id=>state.sites[id]?.investigatedAt!==null&&state.sites[id]),'invalidExploration');
 return true;
}

/** Mutates only the session's private CAS scratch. No localStorage reward counter. */
export async function applyExploration(root,request){
 const {action,id}=request.exploration||{};
 check(['discover','investigate','collect','return'].includes(action),'invalidExplorationAction');
 const state=root.exploration??={version:1,sites:{},returned:[]};
 if(action==='return'){
  for(const [key,r]of Object.entries(state.sites))if(r.investigatedAt!==null&&!state.returned.includes(key))state.returned.push(key);
  return;
 }
 const def=definitionFor(id);check(def,'unknownDestination');
 let record=state.sites[id];
 if(action==='discover'){state.sites[id]??={discoveredAt:root.simTime,investigatedAt:null,collected:0};return;}
 check(record,'destinationUndiscovered');
 if(action==='investigate'){
  if(record.investigatedAt!==null)return;
  record.investigatedAt=root.simTime;
  if(def.quantity){
   const containerId=supplyId(id),itemInstanceId=containerId+':stock';
   const inv=root.inventory,normalized=createState({worldId:root.worldId,holders:inv.holders,
    containers:[...inv.containers,{containerId,kind:'ground',maxSlots:1,maxVolumeMl:'10000',maxMassGrams:'10000'}],
    items:[...inv.items,{itemInstanceId,containerId,definitionId:def.itemId,quantity:def.quantity,maxStack:20,...specs[def.itemId]}]});
   root.inventory={...normalized,revision:inv.revision+1,receipts:inv.receipts,outbox:inv.outbox};
  }
  return;
 }
 check(record.investigatedAt!==null,'destinationNotInvestigated');
 check(def.quantity&&record.collected<def.quantity,'destinationDepleted');
 const inv=root.inventory,item=inv.items.find(i=>i.containerId===supplyId(id));check(item,'explorationStockMismatch');
 const move={transactionId:'exploration:'+request.transactionId,expectedRevision:inv.revision,operations:[{kind:'transfer',itemInstanceId:item.itemInstanceId,fromContainerId:item.containerId,toContainerId:'ST-PACK-01',quantity:1}]};
 const result=await commitTransaction(inv,planTransaction(inv,move),{compareAndSwap:()=>true});
 root.inventory=result.state;record.collected++;
}

export function destinationRecords(root,destinations=DESTINATIONS){const state=explorationState(root);return destinations.map(d=>{
 const r=state.sites[d.id];return {...d,discovered:!!r,investigated:r?.investigatedAt!==null&&!!r,remaining:Math.max(0,(d.quantity||0)-(r?.collected||0)),returned:state.returned.includes(d.id)};
});}
