import {createState,measureContainer,measureHolder} from '../d3-inventory/index.mjs';
import {baseResource} from '../d3-combat/index.mjs';
import {CAMP_ITEMS,MEDICINES,MEDICINE_COOLDOWN,MEDICINE_QUALITY,CAMP_TUTORIAL_KIT,CAMP_SHOP,CAMP_BUYBACK} from './camp-data.mjs';
const PACK='ST-PACK-01';
const check=(condition,message)=>{if(!condition)throw Error(message);};
export const emptyCamp=()=>({version:1,taught:false,kitPending:false,orders:[],orderCount:0,cooldownUntil:0,use:null,heal:null,staminaGrant:{sequence:0,amount:0},shop:Object.fromEntries(Object.entries(CAMP_SHOP).map(([id,d])=>[id,d.stock])),buybackBudget:100});
export const campState=root=>root.camp?{...emptyCamp(),...root.camp}:emptyCamp();
export function validateCamp(c){
  check(c?.version===1&&typeof c.taught==='boolean'&&typeof c.kitPending==='boolean'&&Array.isArray(c.orders)&&c.orders.length<=8,'invalidCamp');
  check(Number.isSafeInteger(c.orderCount)&&c.orderCount>=0&&Number.isFinite(c.cooldownUntil)&&c.cooldownUntil>=0,'invalidCamp');
  for(const o of c.orders)check(typeof o.id==='string'&&MEDICINES[o.recipe]&&Number.isFinite(o.dueAt)&&o.dueAt>=0&&Number.isInteger(o.quality)&&o.quality>=1&&o.quality<=3,'invalidCampOrder');
  check(new Set(c.orders.map(o=>o.id)).size===c.orders.length,'duplicateCampOrder');
  check(c.shop&&Object.keys(CAMP_SHOP).every(id=>Number.isSafeInteger(c.shop[id])&&c.shop[id]>=0)&&Number.isSafeInteger(c.buybackBudget)&&c.buybackBudget>=0,'invalidCampStock');
  check(c.staminaGrant&&Number.isSafeInteger(c.staminaGrant.sequence)&&c.staminaGrant.sequence>=0&&Number.isFinite(c.staminaGrant.amount)&&c.staminaGrant.amount>=0,'invalidCampGrant');
  if(c.use)check(MEDICINES[c.use.recipe]&&typeof c.use.itemId==='string'&&Number.isFinite(c.use.dueAt)&&Number.isFinite(c.use.hpAtStart),'invalidCampUse');
  if(c.heal)check(Number.isInteger(c.heal.total)&&Number.isInteger(c.heal.applied)&&c.heal.applied>=0&&c.heal.applied<=c.heal.total&&Number.isFinite(c.heal.start),'invalidCampHeal');
}
export function packCount(root,id){return root.inventory.items.filter(i=>i.containerId===PACK&&i.definitionId===id&&i.status==='normal').reduce((n,i)=>n+i.quantity,0);}
function take(root,id,quantity,{itemId}={}){
  const items=root.inventory.items.filter(i=>i.containerId===PACK&&i.definitionId===id&&i.status==='normal'&&(!itemId||i.itemInstanceId===itemId)).sort((a,b)=>a.quality-b.quality);
  check(items.reduce((n,i)=>n+i.quantity,0)>=quantity,'campNeedsMaterials');let remaining=quantity;const qualities=[];
  for(const i of items){const n=Math.min(remaining,i.quantity);if(!n)continue;qualities.push(...Array(n).fill(i.quality));i.quantity-=n;remaining-=n;let left=n;
    for(const lot of i.lots){const used=Math.min(left,lot.quantity);lot.quantity-=used;left-=used;}i.lots=i.lots.filter(l=>l.quantity>0);
  }
  root.inventory.items=root.inventory.items.filter(i=>i.quantity>0);return qualities;
}
function add(root,id,quantity,key,quality=3){
  const def=CAMP_ITEMS[id]||{name:'月露苔',unitVolumeMl:'200',unitMassGrams:'100'};
  const existing=root.inventory.items.find(i=>i.containerId===PACK&&i.definitionId===id&&i.quality===quality&&i.status==='normal'&&i.quantity+quantity<=i.maxStack);
  if(existing){existing.quantity+=quantity;existing.lots.push({rootItemId:key,sourceInstanceId:null,quantity});return;}
  const normalized=createState({worldId:root.worldId,holders:root.inventory.holders,containers:root.inventory.containers,items:[...root.inventory.items,{itemInstanceId:key,definitionId:id,containerId:PACK,quantity,maxStack:100,quality,tier:0,unitVolumeMl:def.unitVolumeMl,unitMassGrams:def.unitMassGrams}]});
  root.inventory.items=normalized.items;
}
function capacity(root){const c=root.inventory.containers.find(c=>c.containerId===PACK),u=measureContainer(root.inventory,PACK);
  check(BigInt(u.slots)<=BigInt(c.maxSlots)&&BigInt(u.volumeMl)<=BigInt(c.maxVolumeMl)&&BigInt(u.massGrams)<=BigInt(c.maxMassGrams),'campCapacity');
  check(!measureHolder(root.inventory,c.holderId).overloaded,'campCapacity');
}
export function recipePreview(root,recipe){const d=MEDICINES[recipe];if(!d)return null;const c=campState(root),fee=c.orderCount===0?0:1;
  const qualities=[];
  for(const [id,n] of Object.entries(d.ingredients)){if(id==='solvent')continue;let need=n;for(const i of root.inventory.items.filter(i=>i.containerId===PACK&&i.definitionId===id&&i.status==='normal').sort((a,b)=>a.quality-b.quality)){const used=Math.min(need,i.quantity);qualities.push(...Array(used).fill(i.quality));need-=used;}}
  const quality=qualities.length?Math.min(3,Math.floor(qualities.reduce((a,b)=>a+b,0)/qualities.length),Math.min(...qualities)+1):null;
  return {...d,quality,tier:0,fee,ingredients:Object.entries(d.ingredients).map(([id,needed])=>({id,name:CAMP_ITEMS[id]?.name||'月露苔',needed,owned:packCount(root,id)})),canCraft:c.taught&&c.orders.length<8&&packCount(root,'spirit-fragment')>=fee&&Object.entries(d.ingredients).every(([id,n])=>packCount(root,id)>=n)};
}
/** This reducer runs inside the existing root CAS. Failure discards the entire scratch root. */
export function applyCampOperation(root,request,playerId){
  const c=root.camp={...emptyCamp(),...root.camp},a=request.camp,now=root.simTime,actor=root.combat.actors.find(p=>p.id===playerId);
  check(actor&&Number(actor.hp)>0&&a&&typeof a.action==='string','invalidCampAction');
  const key=suffix=>`camp:${request.transactionId}:${suffix}`;
  if(a.action==='teach'){
    check(!c.taught,'campAlreadyTaught');check(packCount(root,'scavenger-blood')>=1,'campNeedsSample');take(root,'scavenger-blood',1);c.taught=true;c.kitPending=true;
  }else if(a.action==='kit'){
    check(c.kitPending,'campAlreadyTaught');for(const [id,n] of Object.entries(CAMP_TUTORIAL_KIT))add(root,id,n,key(id));capacity(root);c.kitPending=false;
  }else if(a.action==='craft'){
    check(c.taught&&MEDICINES[a.recipe],'campUnknownRecipe');check(c.orders.length<8,'campOrdersFull');const d=MEDICINES[a.recipe],quality=[];
    for(const [id,n] of Object.entries(d.ingredients)){const q=take(root,id,n);if(id!=='solvent')quality.push(...q);}
    const fee=c.orderCount===0?0:1;if(fee)take(root,'spirit-fragment',fee);
    check(Number.isFinite(a.wallTime)&&a.wallTime>0,'invalidCampClock');
    c.orders.push({id:key('order'),recipe:a.recipe,quality:Math.min(3,Math.floor(quality.reduce((a,b)=>a+b,0)/quality.length),Math.min(...quality)+1),dueAt:a.wallTime+d.craftSeconds*1000});c.orderCount++;
  }else if(a.action==='claim'){
    const order=c.orders.find(o=>o.id===a.orderId);check(order,'campNoOrder');check(Number.isFinite(a.wallTime)&&a.wallTime>=order.dueAt,'campNotReady');add(root,order.recipe,1,key('medicine'),order.quality);capacity(root);c.orders=c.orders.filter(o=>o!==order);
  }else if(a.action==='buy'){
    const offer=CAMP_SHOP[a.item];check(offer&&c.shop[a.item]>0,'campOutOfStock');take(root,'spirit-fragment',offer.buy);add(root,a.item,1,key(a.item));capacity(root);c.shop[a.item]--;
  }else if(a.action==='sell'){
    const value=CAMP_BUYBACK[a.item];check(value&&c.buybackBudget>=value,'campBuybackEmpty');take(root,a.item,1);add(root,'spirit-fragment',value,key('coins'));capacity(root);c.buybackBudget-=value;
  }else if(a.action==='use-start'){
    check(!c.use,'campUseActive');check(now>=c.cooldownUntil,'campCooldown');const item=root.inventory.items.find(i=>i.itemInstanceId===a.itemId&&i.containerId===PACK&&i.status==='normal'&&MEDICINES[i.definitionId]);check(item,'campNoMedicine');check(item.tier<=actor.realm+1,'campUnsafeTier');
    c.use={recipe:item.definitionId,itemId:item.itemInstanceId,dueAt:now+MEDICINES[item.definitionId].useSeconds,hpAtStart:Number(actor.hp)};item.status='locked';
  }else if(a.action==='use-cancel'){
    if(c.use){const item=root.inventory.items.find(i=>i.itemInstanceId===c.use.itemId);if(item)item.status='normal';c.use=null;}
  }else if(a.action==='use-finish'){
    const use=c.use;check(use&&now>=use.dueAt,'campUseNotDue');check(Number(actor.hp)>=use.hpAtStart,'campUseInterrupted');const item=root.inventory.items.find(i=>i.itemInstanceId===use.itemId);check(item&&item.status==='locked','campNoMedicine');
    const q=MEDICINE_QUALITY[item.quality],scale=6**Math.min(0,item.tier-actor.realm),recipe=item.definitionId;item.status='normal';take(root,recipe,1,{itemId:use.itemId});
    if(recipe==='MED01'){actor.hp=String(Math.min(Number(actor.maxHp),Number(actor.hp)+Math.floor(Number(actor.maxHp)*.2*q*scale)));c.heal={start:now,total:Math.floor(Number(actor.maxHp)*.15*q*scale),applied:0};}
    if(recipe==='MED02')actor.resource=String(Math.min(Number(baseResource(actor.realm,actor.level)),Number(actor.resource)+Math.floor(Number(baseResource(actor.realm,actor.level))*.35*q*scale)));
    if(recipe==='MED03')c.staminaGrant={sequence:c.staminaGrant.sequence+1,amount:40*q*scale};
    c.cooldownUntil=now+MEDICINE_COOLDOWN;c.use=null;
  }else if(a.action==='heal'){
    check(c.heal,'campNoHealing');const h=c.heal,amount=Math.min(h.total,Math.floor(h.total*Math.max(0,now-h.start)/5));actor.hp=String(Math.min(Number(actor.maxHp),Number(actor.hp)+amount-h.applied));h.applied=amount;if(amount===h.total)c.heal=null;
  }else throw Error('invalidCampAction');
  root.inventory.revision++;validateCamp(c);
}
