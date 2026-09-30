import {SKILLS,skillDefinition,DIFFICULTY,THRESHOLDS,DEMONSTRATIONS} from './definitions.mjs';
import {commitCast,resolveHit,interruptCast,awardPractice,supportAmount,snapshotSkill} from '../d3-combat/index.mjs';
import {fixed,decimal,mul} from '../d3-combat/fixed.mjs';
import {createState,measureContainer,measureHolder} from '../d3-inventory/index.mjs';
import {distance,forward,along,segmentDistance,meleeContact,shieldIntersects,wrap,steerCast} from './geometry.mjs';
const check=(ok,code)=>{if(!ok)throw Error(code);};
const copy=structuredClone;
export const emptySkills=()=>({version:1,learned:{},guides:{},weaponGrants:{},slots:{weapon:null,active:[null,null],passive:[null,null]},cooldowns:{},casts:[],wet:{},thunderUntil:{},barriers:{},marks:[],records:[],feedback:[]});
export const skillsState=root=>root.combatSkills||emptySkills();
function feedback(s,now,text){s.feedback.push({time:now,text});s.feedback=s.feedback.slice(-12);}
export function validateSkills(s){
 check(s?.version===1&&s.slots&&Array.isArray(s.slots.active)&&s.slots.active.length===2&&Array.isArray(s.slots.passive)&&s.slots.passive.length===2,'skillInvalidState');
 for(const [id,l] of Object.entries(s.learned))check(SKILLS[id]&&Number.isInteger(l.mastery)&&l.mastery>=1&&l.mastery<=5&&Number.isInteger(l.tier)&&l.tier>=SKILLS[id].minimumRealm&&l.tier<=9,'skillInvalidLearning');
 const equipped=[s.slots.weapon,...s.slots.active].filter(Boolean);check(new Set(equipped).size===equipped.length&&equipped.every(id=>s.learned[id]),'skillInvalidSlots');
 check(!s.slots.weapon||SKILLS[s.slots.weapon].slot==='weapon','skillInvalidSlots');check(s.slots.active.every(id=>!id||SKILLS[id].slot==='active')&&s.slots.passive.every(id=>id===null),'skillInvalidSlots');
 check(Object.entries(s.cooldowns).every(([id,t])=>SKILLS[id]&&Number.isFinite(t)&&t>=0),'skillInvalidCooldown');
 for(const c of s.casts)check(SKILLS[c.skillId]&&typeof c.id==='string'&&Number.isFinite(c.start)&&c.start<=c.release&&c.release<=c.activeEnd&&c.activeEnd<=c.end&&Number.isFinite(c.last)&&Array.isArray(c.targets),'skillInvalidCast');
}
const findActor=(root,id)=>root.combat.actors.find(a=>a.id===id);
export function usableSkillItem(root,playerId,item){return item.status==='normal'&&root.inventory.containers.some(c=>c.containerId===item.containerId&&c.holderId===playerId&&c.access==='open'&&['backpack','space'].includes(c.kind));}
export function ownsSkillWeapon(root,playerId,kind){return root.inventory.items.some(i=>(i.attributes?.weaponType===kind||i.definitionId===`N06-starter-${kind}`)&&usableSkillItem(root,playerId,i));}
function teachingWeapon(root,s,playerId,kind){
 s.weaponGrants??={};if(s.weaponGrants[kind]||ownsSkillWeapon(root,playerId,kind))return;
 const pack=root.inventory.containers.find(c=>c.holderId===playerId&&c.kind==='backpack'&&c.access==='open');check(pack,'skillNeedsPack');
 const item={itemInstanceId:`N06:${root.worldId}:${playerId}:${kind}`,definitionId:`N06-starter-${kind}`,containerId:pack.containerId,quantity:1,maxStack:1,unitMassGrams:'1200',unitVolumeMl:'1800',attributes:{weaponType:kind}};
 const normalized=createState({worldId:root.worldId,holders:root.inventory.holders,containers:root.inventory.containers,items:[...root.inventory.items,item]}),usage=measureContainer(normalized,pack.containerId);
 check(BigInt(usage.slots)<=BigInt(pack.maxSlots)&&BigInt(usage.volumeMl)<=BigInt(pack.maxVolumeMl)&&BigInt(usage.massGrams)<=BigInt(pack.maxMassGrams)&&!measureHolder(normalized,playerId).overloaded,'skillWeaponCapacity');
 root.inventory.items=normalized.items;root.inventory.revision++;s.weaponGrants[kind]=item.itemInstanceId;
}
const actorAlive=(root,id)=>{const a=findActor(root,id);return a&&a.present!==false&&Number(a.hp)>0;};
const usable=c=>!c.done&&!c.interrupted;
export function skillBusy(root,now=root.simTime){return skillsState(root).casts.some(c=>usable(c)&&now<c.end);}
export function practiceTotal(root,actorId,id){return Number(root.combat.practice.find(p=>p.actorId===actorId&&p.skillId===id)?.total||0);}
function practice(root,s,playerId,id,eventId,kind,effective){
 root.combat=awardPractice(root.combat,{actorId:playerId,skillId:id,eventId,evidence:'ordinary',effective}).state;
 if(effective&&!s.records.some(r=>r.eventId===eventId))s.records.push({eventId,skillId:id,kind});
}
function legalPoint(p){return p&&['x','y','z'].every(k=>Number.isFinite(p[k]));}
/** Invoked ONLY on the private root copy inside D3 session CAS, after spatial authorization.
 * geometry is the existing world adapter, never caller-provided booleans.
 */
export function applySkillOperation(root,request,playerId,geometry){
 const s=root.combatSkills||(root.combatSkills=emptySkills()),op=request.skill,now=root.simTime,actor=findActor(root,playerId),events=[];
 check(actorAlive(root,playerId)&&op&&geometry,'skillUnavailable');
 if(op.action==='guide'){
  const d=SKILLS[op.skillId];check(d&&actor.realm>=d.minimumRealm,'skillRealm');
  const book=root.inventory.items.find(i=>i.definitionId===`manual-${d.id}`&&usableSkillItem(root,playerId,i));
  const foundationTask=d.id==='HS04'&&root.camp?.progression?.quests?.Q04?.status==='claimed';
  // N06 is an explicit spatially authorized teaching source. Advanced books stay in the existing inventory.
  check(d.difficulty===1?geometry.atInstructor?.(playerId)===true:!!book||foundationTask,'skillNeedsSource');
  if(d.difficulty===3)check(s.records.some(r=>r.kind==='sect-trial')||Object.entries(s.learned).some(([id,l])=>SKILLS[id].element===d.element&&l.mastery>=3),'skillNeedsTrial');
  check(!s.learned[d.id],'skillAlreadyLearned');s.guides[d.id]??={demonstrations:[],source:book?.itemInstanceId||(foundationTask?'Q04':'N06')};
  if(d.weapon)teachingWeapon(root,s,playerId,d.weapon);
  feedback(s,now,`${d.name}：完成${DEMONSTRATIONS[d.difficulty]}次正确演示后入门`);
 }else if(op.action==='equip'){
  check(!skillBusy(root),'skillBusy');const d=SKILLS[op.skillId];check(d&&s.learned[d.id],'skillNotLearned');check(!d.weapon||ownsSkillWeapon(root,playerId,d.weapon),'skillNeedsWeapon');
  if(d.slot==='weapon')s.slots.weapon=d.id;else {check(op.slot===0||op.slot===1,'skillInvalidSlot');s.slots.active=s.slots.active.map(id=>id===d.id?null:id);s.slots.active[op.slot]=d.id;}
  feedback(s,now,`${d.name}已装备`);
 }else if(op.action==='upgrade'){
  const d=SKILLS[op.skillId],l=s.learned[op.skillId];check(d&&l&&l.mastery<5,'skillUpgradeUnavailable');
  const kinds=new Set(s.records.filter(r=>r.skillId===d.id).map(r=>r.kind));
  check(practiceTotal(root,playerId,d.id)>=THRESHOLDS[l.mastery]*DIFFICULTY[d.difficulty],'skillNeedsPractice');
  check(l.mastery===1?kinds.size>=1:l.mastery===2?kinds.size>=2:kinds.has(l.mastery===3?'challenge':'comprehensive-trial'),'skillNeedsChallenge');
  l.mastery++;feedback(s,now,`${d.name}掌握提升至${l.mastery}阶；范围、耗能、冷却不变`);
 }else if(op.action==='cast'){
  const d=SKILLS[op.skillId];check(d,'skillUnknown');check(actor.realm>=d.minimumRealm,'skillRealm');
  check(!d.weapon||ownsSkillWeapon(root,playerId,d.weapon),'skillNeedsWeapon');
  check(!skillBusy(root,now),'skillBusy');check(now>=(s.cooldowns[d.id]||0),'skillCooldown');
  const training=op.training===true;
  check(training?!!s.guides[d.id]&&!s.learned[d.id]:!!s.learned[d.id]&&[s.slots.weapon,...s.slots.active].includes(d.id),'skillNotEquipped');
  check(!training||geometry.atInstructor?.(playerId)===true,'skillTrainingLocation');
  const origin=geometry.origin(playerId),body=geometry.position(playerId);check(legalPoint(origin)&&legalPoint(body)&&distance(origin,body)<=2,'skillInvalidOrigin');
  check(Number.isFinite(op.yaw)&&(!Object.hasOwn(op,'pitch')||Number.isFinite(op.pitch)&&Math.abs(op.pitch)<=1.35),'skillInvalidAim');const direction=forward(op.yaw,op.pitch||0);
  const target=d.hit==='H3'?along(origin,direction,Math.max(1,Math.min(d.range,op.aimDistance??10))):null;
  if(target){target.y=geometry.ground(target.x,target.z)+.15;check(legalPoint(target),'skillNoGround');}
  const learned=s.learned[d.id],definition=skillDefinition(d.id,learned);
  const result=commitCast(root.combat,{worldId:root.worldId,castId:request.transactionId,sourceId:playerId,skill:definition});root.combat=result.state;
  s.casts.push({id:request.transactionId,skillId:d.id,training,start:now,release:now+d.windup,activeEnd:now+d.windup+d.activeDuration,end:now+d.windup+d.activeDuration+d.recovery,
   last:now,yaw:wrap(op.yaw),pitch:op.pitch||0,origin:copy(origin),body:copy(body),target,targets:[],released:false,done:false,mastery:definition.mastery,spellPower:actor.spellPower,tier:definition.learnedTier});
  s.cooldowns[d.id]=now+d.cooldown;feedback(s,now,`${d.name}起手 · ${result.cast.resourceKind==='qi'?'真气':'电容'} −${result.cast.cost}`);
 }else if(op.action==='interrupt'){
  const c=s.casts.find(c=>usable(c)&&now<c.end);check(c,'skillNoCast');
  if(op.reason==='dodge'){
   check(now>=c.activeEnd+(c.end-c.activeEnd)*.5,'skillCancelTooEarly');
   c.end=now;c.recoveryCancelled=true;
   // Cancelling recovery never erases a projectile already released into the world.
   if(SKILLS[c.skillId].hit!=='H2'||c.projectileDone)c.done=true;
   feedback(s,now,'已取消收势；在途弹体、资源与冷却保留');
  }else if(c.released&&SKILLS[c.skillId].hit==='H2'){
   c.end=Math.max(c.activeEnd,now);c.recoveryCancelled=true;feedback(s,now,'人物动作中断；已经释放的弹体继续飞行');
  }else{c.interrupted=true;root.combat=interruptCast(root.combat,c.id);feedback(s,now,'施法中断；已扣资源与冷却保留');}
 }else if(op.action==='step'){
  for(const [id,b]of Object.entries(s.barriers))if(now>=b.until){const a=findActor(root,id);if(a)a.barriers=a.barriers.filter(x=>x.id!==b.id);delete s.barriers[id];}
  for(const c of s.casts.filter(usable)){
   if(root.combat.casts.find(x=>x.castId===c.id)?.interrupted){c.interrupted=true;continue;}
   const d=SKILLS[c.skillId],last=c.last;
   // H3 telegraph is fixed at startup. H2 freezes at release minus 0.15s.
   if(d.hit!=='H3')c.yaw=steerCast(c,d,now,geometry.aimYaw?.());
   if(d.hit==='H2'&&now>=c.release-.15)c.aimFrozen=true;
   c.last=now;
   if(now<c.release)continue;
   if(!c.released){
    c.released=true;
    const releaseOrigin=geometry.origin(playerId),releaseBody=geometry.position(playerId);
    if(legalPoint(releaseOrigin)&&legalPoint(releaseBody)&&distance(releaseOrigin,releaseBody)<=2){c.origin=copy(releaseOrigin);c.body=copy(releaseBody);}
    if(c.training){
     if(geometry.atInstructor?.(playerId)&&geometry.demonstration?.(d,c)===true){
      const guide=s.guides[d.id];guide.demonstrations.push(c.id);
      if(guide.demonstrations.length>=DEMONSTRATIONS[d.difficulty]){s.learned[d.id]={tier:d.minimumRealm,mastery:1};feedback(s,now,`${d.name}入门！请装备到${d.slot==='weapon'?'武器战技':'主动'}槽`);}else feedback(s,now,`${d.name}正确演示 ${guide.demonstrations.length}/${DEMONSTRATIONS[d.difficulty]}`);
     }else feedback(s,now,`${d.name}演示未通过：保持站立、朝向训练方向`);
    }else if(d.id==='HS04'){
     const a=findActor(root,playerId),id='HS04';const amount=supportAmount({base:decimal(fixed(10)*6n**BigInt(c.tier)+mul(fixed('1.5'),fixed(c.spellPower))),mastery:c.mastery,kind:'shield'});
     a.barriers=a.barriers.filter(b=>b.id!==id);a.barriers.push({id,amount,channels:['physical','spiritual','direct'],elements:['metal','wood','water','fire','earth','wind','thunder','ice','light','dark','poison','space','mind']});
     s.barriers[playerId]={id,yaw:c.yaw,until:c.release+4,castId:c.id};feedback(s,now,`前方120°屏障 ${amount} · 4秒`);
    }else if(d.id==='HS06'){
     const mark=s.marks.find(m=>m.targetId===playerId&&m.dispellable&&m.due>now&&!m.cleansed&&!m.resolved);
     if(mark){mark.cleansed=true;practice(root,s,playerId,d.id,`cleanse:${mark.id}`,'cleanse',true);feedback(s,now,'解印成功；已经结算的伤害不回滚');}else feedback(s,now,'当前没有可解除的未结算印记');
    }
   }
   if(!c.training&&d.hit!=='H6'){
    const candidates=geometry.targets().filter(t=>t.id!==playerId&&actorAlive(root,t.id)&&!c.targets.includes(t.id)&&legalPoint(t));
    let impacts=[];
    if(d.hit==='H1'&&last<=c.activeEnd&&geometry.clear(c.body,c.origin)){impacts=candidates.filter(t=>meleeContact(d,c,t,Math.max(c.release,last),Math.min(now,c.activeEnd))).map(t=>({t,distance:distance(c.origin,t)}));}
    if(d.hit==='H3'&&last<=c.release){impacts=candidates.filter(t=>Math.hypot(t.x-c.target.x,t.z-c.target.z)<=1&&(Math.abs(t.y-c.target.y)<=2)).map(t=>({t,distance:distance(c.target,t)}));}
    if(d.hit==='H2'&&!c.projectileDone){
     const start=along(c.origin,forward(c.yaw,c.pitch||0),Math.min(d.range,Math.max(0,last-c.release)*24)),end=along(c.origin,forward(c.yaw,c.pitch||0),Math.min(d.range,Math.max(0,now-c.release)*24));
     // Swept segment prevents tunneling at 30 FPS; body->palm test prevents wall spawning.
     if(!geometry.clear(c.body,c.origin)||!geometry.clear(start,end)){c.projectileDone=true;feedback(s,now,'激流矢被遮挡');}
     else{impacts=candidates.map(target=>{const contact=segmentDistance(target,start,end);return {t:target,distance:contact.t,miss:contact.distance};}).filter(x=>x.miss<=.15+(x.t.radius??.35));if(impacts.length)c.projectileDone=true;}
     if((now-c.release)*24>=d.range)c.projectileDone=true;
    }
    impacts.sort((a,b)=>a.distance-b.distance);
    for(const {t}of impacts.slice(0,d.maxTargets-c.targets.length)){
     if(!geometry.clear(c.origin,t)){feedback(s,now,`${d.name}被遮挡`);continue;}
     if(d.id==='ES13'&&(s.wet[t.id]||0)>c.release&&now>=(s.thunderUntil[t.id]||0)){
      const cast=root.combat.casts.find(x=>x.castId===c.id);const definition=skillDefinition(d.id,{mastery:c.mastery,tier:c.tier});
      // Exactly one bonus bucket; snapshot stays frozen to cast-start source attributes.
      const original=cast.snapshot;cast.snapshot=snapshotSkill({source:original.source,skill:definition,damageBonuses:[.1]});s.thunderUntil[t.id]=now+3;
      const hit=resolveSkillHit(root,s,c,t,playerId,geometry);events.push(...hit.events);root.combat.casts.find(x=>x.castId===c.id).snapshot=original;
     }else events.push(...resolveSkillHit(root,s,c,t,playerId,geometry).events);
     if(d.id==='ES05')s.wet[t.id]=now+3;
     if(d.id==='WS01'){const target=findActor(root,t.id);target.poise=Math.max(0,(target.poise??100)-20);}
    }
   }
   const projectileAlive=d.hit==='H2'&&!c.training&&!c.projectileDone;
   if(now>=c.end&&!projectileAlive){c.done=true;if(!c.training&&d.hit!=='H6'&&!c.targets.length)feedback(s,now,`${d.name}落空`);}
  }
 }else throw Error('skillUnknownAction');
 validateSkills(s);return events;
}
function resolveSkillHit(root,s,c,t,playerId,geometry){
 const barrier=s.barriers[t.id],hitId=`${c.id}:0:${t.id}`;
 const hit=resolveHit(root.combat,{worldId:root.worldId,castId:c.id,hitId,targetId:t.id,segment:0,barrierIds:shieldIntersects(barrier,c.origin,t,root.simTime)?[barrier.id]:[]});root.combat=hit.state;c.targets.push(t.id);
 const actual=Number(hit.result.lifeLoss)>0||hit.result.components.some(x=>x.barrierAbsorption.length||x.shieldAbsorption.length);
 practice(root,s,playerId,c.skillId,hitId,hit.result.defeated?'defeat':'hit',actual&&findActor(root,t.id)?.trainingDummy!==true);
 feedback(s,root.simTime,`${SKILLS[c.skillId].name}命中 · 生命 −${hit.result.lifeLoss}${c.skillId==='WS01'?' · 削韧20':c.skillId==='ES05'?' · 潮湿3秒':''}`);return hit;
}
/** Hostile H5 adapters register a real committed lock, never an arbitrary UI token. */
export function registerLock(root,{id,castId,targetId,start,due,dispellable=true}){
 const cast=root.combat.casts.find(c=>c.castId===castId);check(cast&&!cast.interrupted&&due-start>=.8,'skillInvalidLock');
 const s=root.combatSkills||(root.combatSkills=emptySkills());check(!s.marks.some(m=>m.id===id),'skillDuplicateLock');s.marks.push({id,castId,targetId,start,due,dispellable,cleansed:false,resolved:false});
}
export function lockCancelled(root,id){const mark=skillsState(root).marks.find(m=>m.id===id);return !!mark?.cleansed;}
export function checkMarkedHit(root,hit){const marks=skillsState(root).marks.filter(m=>m.castId===hit.castId&&m.targetId===hit.targetId);if(!marks.length)return;
 check(!marks.some(m=>m.cleansed),'skillLockCleansed');check(marks.every(m=>root.simTime>=m.due),'skillLockNotDue');}
export function settleMarkedHit(root,hit){for(const m of skillsState(root).marks)if(m.castId===hit.castId&&m.targetId===hit.targetId)m.resolved=true;}
export function incomingBarrierIds(root,targetId,from,to){const b=skillsState(root).barriers[targetId];return shieldIntersects(b,from,to,root.simTime)?[b.id]:[];}
export function recordBarrierPractice(root,playerId,hit){const s=root.combatSkills,b=s?.barriers[playerId];if(!b)return;const blocked=hit.components?.some(c=>c.barrierAbsorption.some(a=>a.id===b.id&&Number(a.absorbed)>0));if(blocked)practice(root,s,playerId,'HS04',`block:${root.combat.hits.at(-1)?.hitId}`,'block',true);}
