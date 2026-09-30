import {createState,measureContainer,measureHolder} from '../d3-inventory/index.mjs';
import {baseResource,computeAttributes} from '../d3-combat/index.mjs';
import {emptyCamp,applyCampOperation} from '../foundation/camp-state.mjs';
import {CAMP_SHOP,CAMP_BUYBACK,CAMP_ITEMS} from '../foundation/camp-data.mjs';
import {QUESTS,PROGRESSION_ITEMS,xpRequired,TRIAL_NODES,REALMS} from './data.mjs';
const PACK='ST-PACK-01',check=(v,m)=>{if(!v)throw Error(m);};
export const emptyProgression=()=>({version:1,quests:{},xp:0,fraction:0,training:null,trainingReport:null,clock:0,trial:{nodes:[],active:null,calibrated:false},breakthrough:false,refinements:0,combatRewarded:[]});
export const progressionState=root=>root.camp?.progression||emptyProgression();
export const countItem=(root,id)=>root.inventory.items.filter(i=>i.containerId===PACK&&i.definitionId===id&&i.status==='normal').reduce((n,i)=>n+i.quantity,0);
export function validateProgression(p){
 check(p?.version===1&&Number.isSafeInteger(p.xp)&&p.xp>=0&&Number.isFinite(p.fraction)&&p.fraction>=0&&p.fraction<1,'invalidProgression');
 check(p.quests&&Object.entries(p.quests).every(([id,q])=>QUESTS[id]&&['active','claimed'].includes(q.status)&&Number.isSafeInteger(q.acceptedRevision)&&q.acceptedRevision>=0),'invalidProgressionQuest');
 check(Array.isArray(p.combatRewarded)&&new Set(p.combatRewarded).size===p.combatRewarded.length&&p.combatRewarded.every(id=>typeof id==='string'),'invalidProgressionCombat');
 check(Number.isFinite(p.clock)&&p.clock>=0&&typeof p.breakthrough==='boolean'&&Number.isSafeInteger(p.refinements)&&p.refinements>=0,'invalidProgression');
 check(Array.isArray(p.trial?.nodes)&&new Set(p.trial.nodes).size===p.trial.nodes.length&&p.trial.nodes.every(id=>TRIAL_NODES.some(n=>n.id===id))&&typeof p.trial.calibrated==='boolean','invalidProgressionTrial');
 if(p.trial.active)check(TRIAL_NODES.some(n=>n.id===p.trial.active.id)&&Number.isFinite(p.trial.active.start)&&p.trial.active.start>=0,'invalidProgressionTrial');
 if(p.training)check(['online','offline'].includes(p.training.mode)&&Number.isFinite(p.training.start)&&p.training.start>=0&&Number.isFinite(p.training.last)&&p.training.last>=p.training.start,'invalidProgressionTraining');
}
function take(root,id,n){
 check(countItem(root,id)>=n,'progressionMaterials');
 for(const i of root.inventory.items.filter(i=>i.containerId===PACK&&i.definitionId===id&&i.status==='normal')){const used=Math.min(i.quantity,n);i.quantity-=used;n-=used;let left=used;for(const lot of i.lots){const k=Math.min(left,lot.quantity);lot.quantity-=k;left-=k;}i.lots=i.lots.filter(l=>l.quantity>0);}
 root.inventory.items=root.inventory.items.filter(i=>i.quantity>0);
}
function add(root,id,n,key){if(!n)return;const d=PROGRESSION_ITEMS[id];check(d,'unknownProgressionItem');
 const normalized=createState({worldId:root.worldId,holders:root.inventory.holders,containers:root.inventory.containers,items:[...root.inventory.items,{itemInstanceId:key,definitionId:id,quantity:n,maxStack:100,containerId:PACK,unitMassGrams:d.unitMassGrams,unitVolumeMl:d.unitVolumeMl}]});root.inventory.items=normalized.items;
 const cap=root.inventory.containers.find(c=>c.containerId===PACK),u=measureContainer(root.inventory,PACK);
 check(BigInt(u.slots)<=BigInt(cap.maxSlots)&&BigInt(u.massGrams)<=BigInt(cap.maxMassGrams)&&BigInt(u.volumeMl)<=BigInt(cap.maxVolumeMl)&&!measureHolder(root.inventory,cap.holderId).overloaded,'progressionCapacity');
}
function playerDefeat(root,event,playerId){
 if(event?.kind!=='defeatCommitted'||event.committed!==true||event.worldId!==root.worldId||event.eventId!==`defeat:${JSON.stringify([root.worldId,event.sourceInstanceId])}`)return null;
 const target=root.combat.actors.find(a=>a.id===event.sourceInstanceId);
 if(!target||target.id===playerId||target.defeatEligible!==true||target.trainingDummy===true||Number(target.hp)!==0||!root.drops.some(d=>d.created&&d.memberId===target.id))return null;
 const hit=root.combat.hits.find(h=>!h.aliasOf&&h.targetId===target.id&&h.result?.defeated&&h.result.target?.id===target.id&&root.combat.casts.find(c=>c.castId===h.castId)?.sourceId===playerId&&root.combatSkills?.casts.find(c=>c.id===h.castId)?.training!==true);
 return hit?{target,hit}:null;
}
/** Evidence is derived from committed inventory receipts and combat casts/hits, never request flags. */
export function evidence(root,playerId){
 const gathered={};
 for(const receipt of root.inventory.receipts)for(const c of receipt.changes||[]){
   const container=root.inventory.containers.find(x=>x.containerId===c.fromContainerId);
   if(container?.kind!=='resource'||c.toContainerId!==PACK)continue;
   const instance=Object.values(root.director.anchors).flatMap(s=>[s.current,...(s.history||[])]).find(i=>i?.instanceId===container.sourceInstanceId);
   const definitionId=c.definitionId||root.inventory.items.find(i=>i.itemInstanceId===c.itemInstanceId||i.lots.some(l=>l.rootItemId===c.itemInstanceId))?.definitionId||instance?.combination?.family;
   if(definitionId)gathered[definitionId]=(gathered[definitionId]||0)+c.quantity;
 }
 const killed=new Set((root.events||[]).filter(e=>playerDefeat(root,e,playerId)).map(e=>e.sourceInstanceId));
 return {gathered,kills:killed.size,bloodStudy:root.camp?.taught===true};
}
export function questReady(root,id,playerId){const e=evidence(root,playerId);
 if(id==='Q01')return (e.gathered['moon-moss']||0)>=2&&e.kills>=1&&e.bloodStudy;
 if(id==='Q02')return (e.gathered['meteor-iron']||0)>=1&&countItem(root,'meteor-iron')>=2;
 if(id==='Q03')return countItem(root,'moon-moss')>=3;
 if(id==='Q05')return Number.isFinite(root.exploration?.sites?.['wind-stones']?.investigatedAt)&&root.exploration?.returned?.includes('wind-stones');
 return id==='Q04'&&e.bloodStudy;
}
function grow(actor,p,amount){
 const before={realm:actor.realm,level:actor.level};let left=Math.max(0,amount);
 while(left>0){const need=xpRequired(actor.realm,actor.level)-p.xp,take=Math.min(left,need);p.xp+=take;left-=take;if(p.xp<xpRequired(actor.realm,actor.level)||actor.level===10)break;p.xp=0;actor.level++;}
 if(before.level!==actor.level)rescale(actor,before);
 return amount-left;
}
export function creditProgressionCombat(root,request,events,playerId){
 if(!events.length||!(request.kind==='hit'||request.kind==='skill'&&request.skill?.action==='step'))return;
 const defeats=events.map(e=>({event:e,defeat:playerDefeat(root,e,playerId)})).filter(({defeat})=>defeat&&(request.kind!=='hit'||defeat.hit.castId===request.hit?.castId));
 if(!defeats.length)return;
 const camp=root.camp||(root.camp=emptyCamp()),p=camp.progression||(camp.progression=emptyProgression()),actor=root.combat.actors.find(a=>a.id===playerId);
 for(const {event:e,defeat:{target}} of defeats){if(p.combatRewarded.includes(e.eventId))continue;p.combatRewarded.push(e.eventId);if(target.realm>actor.realm-2)grow(actor,p,Math.max(1,Math.round(xpRequired(actor.realm,actor.level)*.03)));}
}
function rescale(actor,before){
 const old=computeAttributes(before).effective,updated=computeAttributes({realm:actor.realm,level:actor.level}).effective;
 // Preserve pre-existing flat equipment/legacy differences without creating another stat pool.
 for(const stat of ['maxHp','attack','defense','spellPower','resistance'])if(actor[stat]!==undefined)actor[stat]=String(Math.max(0,Math.round(Number(updated[stat]))+Number(actor[stat])-Math.round(Number(old[stat]))));
 actor.hp=String(Math.min(Number(actor.hp),Number(actor.maxHp)));actor.resource=String(Math.min(Number(actor.resource),Number(baseResource(actor.realm,actor.level))));
}
function settle(root,p,actor,wallTime,stop=false){
 const t=p.training;if(!t)return;
 const now=t.mode==='online'?root.simTime:wallTime;
 check(Number.isFinite(now)&&now>=0,'progressionClock');
 const max=t.start+(t.mode==='offline'?72*3600000:72*3600),end=Math.max(t.last,Math.min(now,max));
 const hours=(end-t.last)/(t.mode==='offline'?3600000:3600),raw=hours*20*4**actor.realm*(t.mode==='offline'?.5:1)+p.fraction;
 const gained=grow(actor,p,Math.floor(raw));p.fraction=raw-Math.floor(raw);t.last=end;
 if(t.mode==='offline')p.clock=Math.max(p.clock,end);
 const full=actor.level===10&&p.xp>=xpRequired(actor.realm,10);
 p.trainingReport={mode:t.mode,hours,gained,cost:0,reason:full?'待突破':end>=max?'72小时上限':stop?'已停止':'修炼中'};
 if(full||end>=max||stop){p.training=null;if(full)p.fraction=0;}
}
/** Mutates only the private D3 root scratch. Caller must publish only after root CAS succeeds. */
export function applyProgressionOperation(root,request,playerId){
 const actor=root.combat.actors.find(a=>a.id===playerId),a=request.progression;
 check(actor&&Number(actor.hp)>0&&a,'invalidProgressionAction');
 const camp=root.camp||(root.camp=emptyCamp()),p=camp.progression||(camp.progression=emptyProgression());
 const key=s=>`progression:${request.transactionId}:${s}`;
 if(a.action==='accept'){
   const q=QUESTS[a.quest];check(q&&q.npc===a.npc&&(!q.requires||p.quests[q.requires]?.status==='claimed')&&(a.quest!=='Q04'||camp.taught),'questUnavailable');
   check(!p.quests[a.quest],'questClaimed');p.quests[a.quest]={status:'active',acceptedRevision:root.revision};
 }else if(a.action==='deliver'){
   const q=QUESTS[a.quest];check(q&&q.npc===a.npc&&p.quests[a.quest]?.status==='active','questClaimed');check(questReady(root,a.quest,playerId),'questEvidence');
   if(a.quest==='Q02')take(root,'meteor-iron',2);if(a.quest==='Q03')take(root,'moon-moss',3);
   add(root,'spirit-fragment',q.coins,key('reward'));grow(actor,p,q.xp);p.quests[a.quest].status='claimed';
 }else if(a.action==='refine'){
   check(a.npc==='N03'&&p.quests.Q02?.status==='claimed','progressionLocked');take(root,'meteor-iron',2);add(root,'refined-meteor-iron',1,key('refined'));p.refinements++;
 }else if(a.action==='exchange'){
   check(a.npc==='N04'&&['up','down'].includes(a.direction),'invalidProgressionAction');
   take(root,a.direction==='up'?'spirit-fragment':'spirit-stone',a.direction==='up'?100:1);add(root,a.direction==='up'?'spirit-stone':'spirit-fragment',a.direction==='up'?1:100,key('exchange'));
 }else if(a.action==='buy'||a.action==='sell'){
   check(a.npc==='N04','progressionLocked');applyCampOperation(root,{...request,camp:{action:a.action,item:a.item}},playerId);
 }else if(a.action==='sell-refined'){
   check(a.npc==='N04'&&camp.buybackBudget>=10,'progressionLocked');take(root,'refined-meteor-iron',1);add(root,'spirit-fragment',10,key('sale'));camp.buybackBudget-=10;
 }else if(a.action==='train-start'){
   check(a.npc==='N05'&&p.quests.Q04?.status==='claimed','progressionLocked');check(!p.training,'progressionTraining');check(['online','offline'].includes(a.mode),'invalidProgressionAction');
   check(Number.isFinite(a.wallTime)&&a.wallTime>0,'progressionClock');const start=a.mode==='online'?root.simTime:Math.max(a.wallTime,p.clock);p.training={mode:a.mode,start,last:start};
 }else if(a.action==='train-settle'||a.action==='train-stop'){settle(root,p,actor,a.wallTime,a.action==='train-stop');
 }else if(a.action==='trial-start'){
   check(p.quests.Q04?.status==='claimed'&&!p.training,'progressionLocked');const node=TRIAL_NODES.find(n=>n.id===a.node);
   check(node&&!p.trial.nodes.includes(node.id)&&a.tuning===node.tuning,'progressionTrial');p.trial.active={id:node.id,start:root.simTime};
 }else if(a.action==='trial-cancel'){p.trial.active=null;
 }else if(a.action==='trial-finish'){
   check(p.trial.active?.id===a.node&&root.simTime-p.trial.active.start>=8,'progressionTrial');check(Number(actor.resource)>=20,'progressionTrial');actor.resource=String(Number(actor.resource)-20);p.trial.nodes.push(a.node);p.trial.active=null;grow(actor,p,60);
 }else if(a.action==='calibrate'){
   check(a.npc==='N05'&&p.quests.Q04?.status==='claimed'&&p.trial.nodes.length===3,'progressionTrial');p.trial.calibrated=true;
 }else if(a.action==='breakthrough'){
   check(a.npc==='N05'&&!p.training&&actor.realm===0&&actor.level===10&&p.xp===xpRequired(0,10)&&p.trial.calibrated&&p.trial.nodes.length===3&&!p.breakthrough,'progressionBreakthrough');
   const before={realm:actor.realm,level:actor.level};actor.realm=1;actor.level=1;p.xp=0;p.fraction=0;p.breakthrough=true;rescale(actor,before);
 }else throw Error('invalidProgressionAction');
 root.inventory.revision++;validateProgression(p);
}
export function progressionView(root,playerId){const p=progressionState(root),actor=root.combat.actors.find(a=>a.id===playerId);return {
 ...structuredClone(p),realm:actor.realm,level:actor.level,realmName:REALMS[actor.realm],required:xpRequired(actor.realm,actor.level),evidence:evidence(root,playerId),
 quests:Object.entries(QUESTS).map(([id,q])=>({...q,id,status:p.quests[id]?.status||'available',ready:questReady(root,id,playerId),available:(!q.requires||p.quests[q.requires]?.status==='claimed')&&(id!=='Q04'||root.camp?.taught===true)})),
 coins:countItem(root,'spirit-fragment'),stones:countItem(root,'spirit-stone'),iron:countItem(root,'meteor-iron'),refined:countItem(root,'refined-meteor-iron'),
 market:{budget:(root.camp||emptyCamp()).buybackBudget,shop:Object.entries(CAMP_SHOP).map(([id,d])=>({id,name:CAMP_ITEMS[id]?.name||'月露苔',price:d.buy,stock:(root.camp||emptyCamp()).shop[id]})),buyback:Object.entries(CAMP_BUYBACK).map(([id,price])=>({id,name:CAMP_ITEMS[id]?.name||({'meteor-iron':'铁陨材','scavenger-blood':'掠兽血液','moon-moss':'月露苔'}[id]),price,owned:countItem(root,id)}))},
 canBreakthrough:actor.realm===0&&actor.level===10&&p.xp===xpRequired(0,10)&&p.trial.calibrated&&!p.training,
 capabilities:{normalAtmosphereBreathing:actor.realm>=1,selfFlightMaxHeight:actor.realm>=4?2000:0},
 };}
