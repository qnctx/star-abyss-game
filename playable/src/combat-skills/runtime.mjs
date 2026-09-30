import {SKILLS,STAGES,DEMONSTRATIONS,THRESHOLDS,DIFFICULTY} from './definitions.mjs';
import {skillsState,skillBusy,practiceTotal,incomingBarrierIds,ownsSkillWeapon,usableSkillItem} from './state.mjs';
import {castPhase,along,forward,distance,wrap,steerCast} from './geometry.mjs';
// N06 is a shared existing-character instance; no new creature or character asset.
export const INSTRUCTOR={id:'N06',name:'祁岳 · 战技教官',x:-3,z:178,radius:4};
export const SKILL_ITEM_NAMES={'N06-starter-saber':'祁岳配发·练习刀','N06-starter-sword':'祁岳配发·练习剑'};
export const SKILL_MESSAGES={skillNeedsWeapon:'对应武器不在随身背包；从仓库取回后再施放。',skillWeaponCapacity:'腾出1格、1.8L和1.2kg容量后领取教具。',skillRealm:'境界不足，先完成真实突破。',skillNeedsSource:'需要对应秘籍，或前往祁岳处接受基础教学。',skillNeedsTrial:'需要同系精通或真实宗门试炼记录。',skillBusy:'请等待收势完成。',skillCooldown:'战技冷却尚未结束。',skillNotEquipped:'先学习并装备到对应战技槽。',skillNotLearned:'尚未入门，请先完成导引演示。',skillNeedsPractice:'有效实战熟练度尚未达标。',skillNeedsChallenge:'缺少进阶所需实战种类或挑战记录。',skillTrainingLocation:'需在祁岳训练区完成演示。',skillCancelTooEarly:'恢复前半段不可用闪避取消。', 'insufficient resource':'电容或真气不足；起手未提交，未扣资源。'};
export function createSkillBridge({getRoot,getContext,getScene,playerId,queries,issue,getPalm,isBusy,protectedPoint=()=>false}){
 const body=p=>({x:p.x,y:Number.isFinite(p.y)?p.y+1.05:queries.terrainHeight(p.x,p.z)+1.05,z:p.z});
 const atInstructor=()=>{const c=getContext();return !c.mounted&&!c.airborne&&Math.hypot(c.player.x-INSTRUCTOR.x,c.player.z-INSTRUCTOR.z)<INSTRUCTOR.radius&&queries.hasLineOfSight(body(c.player),body(INSTRUCTOR));};
 const position=id=>body(id===playerId?getContext().player:getScene().enemies[id]);
 const geometry={position,ground:queries.terrainHeight,clear:queries.hasLineOfSight,aimYaw:()=>getContext().player.yaw,
  origin:id=>{const palm=getPalm?.(),p=position(id);return id===playerId&&palm&&distance(p,palm)<=2?{x:palm.x,y:palm.y,z:palm.z}:along(p,forward(getContext().player.yaw,getContext().player.pitch||0),.55);},
  targets:()=>protectedPoint(getContext().player)?[]:Object.keys(getScene().enemies).map(id=>({id,...position(id),radius:.35})).filter(p=>!protectedPoint(p)),
  atInstructor,demonstration:(_d,c)=>atInstructor()&&Math.abs(wrap(c.yaw))<Math.PI/4&&!getContext().sprinting};
 function authorize(state,request){
  const c=getContext(),op=request.skill;if(request.kind!=='skill'||!op||!c.playing)return false;
  const player=state.combat.actors.find(a=>a.id===playerId);if(!player||Number(player.hp)<=0)return false;
  if(op.action==='interrupt')return !c.menu;
  if(op.action==='step')return !c.menu&&!c.skillMenu;
  const aerial=c.flying===true&&c.combatZone===true&&!c.remote&&Number(player.realm)>=4;
  if(c.mounted||c.prone||c.airborne&&!aerial)return false;
  if(aerial&&op.action!=='cast')return false;
  if(['guide','equip','upgrade'].includes(op.action))return atInstructor()||op.action!=='guide';
  if(op.action==='cast')return !c.menu&&!c.skillMenu&&!c.sprinting&&!state.camp?.use&&!getScene().pending[playerId]&&Math.abs(wrap(op.yaw-c.player.yaw))<.01;
  return false;
 }
 const request=skill=>issue('skill',{skill,scene:{...structuredClone(getScene()),player:{x:getContext().player.x,z:getContext().player.z,...(Number.isFinite(getContext().player.y)?{y:getContext().player.y}:{}),yaw:wrap(getContext().player.yaw),pitch:getContext().player.pitch||0}}});
 async function action(action){
  if(action.type==='skill-cast'){const s=skillsState(getRoot()),id=action.skillId||(action.slot==='weapon'?s.slots.weapon:s.slots.active[action.slot]);if(!id)return false;return request({action:'cast',skillId:id,yaw:wrap(getContext().player.yaw),pitch:getContext().player.pitch||0,aimDistance:action.aimDistance??10,training:!!action.training});}
  if(action.type==='skill-manage')return request(action.skill);
  return false;
 }
 function tick(){const s=skillsState(getRoot()),now=getScene().time;if(isBusy())return false;
  const context=getContext(),aerial=context.flying===true&&context.combatZone===true&&!context.remote&&Number(getRoot().combat.actors.find(a=>a.id===playerId)?.realm)>=4;
  if((context.mounted||context.airborne&&!aerial||context.prone)&&skillBusy(getRoot(),now)){void request({action:'interrupt',reason:'state-change'});return true;}
  const due=s.casts.some(c=>{if(c.done||c.interrupted)return false;const d=SKILLS[c.skillId];
   if(!c.released)return now>=c.release||d.hit==='H2'&&!c.aimFrozen&&now>=c.release-.15;
   if(d.hit==='H1'&&c.last<c.activeEnd)return now-c.last>=1/120;
   if(d.hit==='H2'&&!c.projectileDone&&!c.training)return now-c.last>=1/30;
   return now>=c.end;
  });
  if(due||Object.values(s.barriers).some(b=>b.until<=now)){void request({action:'step'});return true;}return false;}
 function view(){const root=getRoot(),s=skillsState(root),now=getScene().time,c=getContext(),p=root.combat.actors.find(a=>a.id===playerId);
  return {nearInstructor:atInstructor(),instructor:INSTRUCTOR,slots:s.slots,busy:isBusy(),casting:skillBusy(root,now),resource:Number(p.resource),resourceKind:p.realm?'真气':'电容',feedback:s.feedback.at(-1)?.text||'',
   skills:Object.values(SKILLS).map(d=>({id:d.id,name:d.name,slot:d.slot,weapon:d.weapon,realm:d.minimumRealm,difficulty:d.difficulty,learned:!!s.learned[d.id],stage:s.learned[d.id]?STAGES[s.learned[d.id].mastery-1]:'未入门',mastery:s.learned[d.id]?.mastery||0,
    demonstrations:s.guides[d.id]?.demonstrations.length||0,required:DEMONSTRATIONS[d.difficulty],guided:!!s.guides[d.id],practice:practiceTotal(root,playerId,d.id),cooldown:Math.max(0,(s.cooldowns[d.id]||0)-now),cost:Math.round(d.costPercent*100),
    sourceAvailable:d.difficulty===1||d.id==='HS04'&&root.camp?.progression?.quests?.Q04?.status==='claimed'||root.inventory.items.some(i=>i.definitionId===`manual-${d.id}`&&usableSkillItem(root,playerId,i)),
    upgradeReady:!!s.learned[d.id]&&s.learned[d.id].mastery<5&&practiceTotal(root,playerId,d.id)>=THRESHOLDS[s.learned[d.id].mastery]*DIFFICULTY[d.difficulty],
    realmAllowed:p.realm>=d.minimumRealm,source:d.difficulty===1?'N06祁岳教学':d.id==='HS04'?'完成闻止导引课Q04 / 对应秘籍':d.difficulty===2?'对应秘籍（战斗任务 / 书商）':'对应秘籍与同系精通 / 宗门试炼',equipped:[s.slots.weapon,...s.slots.active].includes(d.id),disabled:c.mounted||c.prone||c.airborne&&!(c.flying===true&&c.combatZone===true&&!c.remote&&p.realm>=4)||!!c.menu}))};}
 function combatView(){const s=skillsState(getRoot()),now=getScene().time;return {casts:s.casts.filter(c=>now<c.end+.2||!c.done&&!c.interrupted||s.barriers[playerId]?.castId===c.id).map(c=>({...c,yaw:SKILLS[c.skillId].hit==='H3'?c.yaw:steerCast(c,SKILLS[c.skillId],now,getContext().player.yaw)})),phase:castPhase(s.casts.find(c=>castPhase(c,now)),now),weapon:SKILLS[s.slots.weapon]?.weapon&&ownsSkillWeapon(getRoot(),playerId,SKILLS[s.slots.weapon].weapon)?SKILLS[s.slots.weapon].weapon:null,barriers:s.barriers,time:now,actorId:playerId};}
 function motion(){const now=getScene().time,c=skillsState(getRoot()).casts.find(c=>castPhase(c,now));if(!c)return null;return {speed:now<c.release?.55:now<c.activeEnd?.2:.7,canDodge:now>=c.activeEnd+(c.end-c.activeEnd)*.5};}
 return {geometry,authorize,action,tick,view,combatView,motion,cancel:()=>request({action:'interrupt',reason:'dodge'}),busy:()=>skillBusy(getRoot(),getScene().time),incoming:(id,from,to)=>incomingBarrierIds({...getRoot(),simTime:getScene().time},id,from,to)};
}
