import {createSkillBridge,SKILL_MESSAGES,SKILL_ITEM_NAMES} from '../combat-skills/runtime.mjs';
import {createSession,canonical} from '../d3-session/index.mjs';
import {openIndexedDB} from '../d3-session/indexeddb.mjs';
import {measureContainer,measureHolder} from '../d3-inventory/index.mjs';
import {baseResource} from '../d3-combat/index.mjs';
import {rulesFor,initialRoot,PACK,CAMP,ITEMS,ATTACK,TIMING,angle,distance,pose,canHit,combatBody,ARENA_ID,ARENA_SITE,RIFTWING_ID,RIFTWING_SITE} from './rules.mjs';
import {BOLT_REACH,airAttackForRealm,airSkill,airTargets,rayContact,aimedPoint,boltHitsAim} from './aerial-combat.mjs';
import {AIR_MELEE,meleeMoveForKind,meleeSkill,nextMeleeMove,meleeContact,guardedImpact,meleeImpulse} from './aerial-melee.mjs';
import {steerCreature,canBeginCreatureAttack} from './creature-ai.mjs';
import {RIFTWING_ATTACKS,RIFTWING_ENVELOPE,isRiftwingKind,riftwingAttack,riftwingSkill,riftwingContact,initialRiftwingState,advanceRiftwing} from './riftwing-ai.mjs';
import {PHYSICIAN,CAMP_ITEMS,MEDICINES,CAMP_MESSAGES,CAMP_SHOP,CAMP_BUYBACK} from '../foundation/camp-data.mjs';
import {campState,recipePreview,packCount} from '../foundation/camp-state.mjs';
import {createProgressionRuntime} from '../progression-quests/runtime.mjs';
import {MESSAGES as PROGRESSION_MESSAGES,PROGRESSION_ITEMS} from '../progression-quests/data.mjs';
import {createCheckpointClient} from '../performance/checkpoint-client.mjs';

const clone=structuredClone;
const count=(root,id)=>root.inventory.items.filter(x=>x.containerId===id).reduce((n,x)=>n+x.quantity,0);
export const sceneConfigFor=playerId=>({playerId,safePoint:{x:0,z:190,yaw:0,pitch:0},
  poseBounds:{xMin:-3000,xMax:3000,zMin:-3000,zMax:3000,pitchMin:-1.35,pitchMax:1.35}});
  const messages={...CAMP_MESSAGES,...SKILL_MESSAGES,...PROGRESSION_MESSAGES,accessDenied:'动作条件已改变，请重新靠近或等待前摇。',capacityExceeded:'背包容量不足，原物仍留在现场。',
  holderOverloaded:'携重达到上限，原物留在现场；回营地打开背包存入物资后可继续。',
  slotsFull:'背包格数已满，原物仍留在现场。',volumeFull:'背包容积不足，原物仍留在现场。',massFull:'背包结构载重已满，原物仍留在现场。',
  carryLimitExceeded:'携重达到上限，请回营地存放物资。',noEligiblePlan:'此区域当前不满足安全补充条件。',
  revisionConflict:'另一页面更新了存档，已读取最新状态。',commitRejected:'保存未提交，未发放物资。'};

/** Real original-player adapter. Only I.execute publishes combat, inventory and director changes. */
export async function createExpeditionRuntime({link,world,queries,getContext,onChange=()=>{},onRescue=()=>{},isVisible,
  explorationAccess=()=>false,onAirImpulse=()=>{},
  getPalm,openStorage=openIndexedDB,makeId=()=>crypto.randomUUID(),clockMs=()=>performance.now(),checkpointStorageName=openStorage===openIndexedDB?'star-abyss-original-expedition-v1':null}) {
  for(const key of ['terrainHeight','canOccupy','canTraverse','hasLineOfSight','dynamicBlocked']) {
    if(typeof queries?.[key]!=='function')throw new TypeError('Required expedition query: '+key);
  }
  const arena=link.worldId.startsWith('test-lab:arena:'),rules=rulesFor(world,{arena,playerActor:()=>root?.combat.actors.find(a=>a.id===link.playerId)}),sceneConfig=sceneConfigFor(link.playerId);
  const storage=await openStorage({name:'star-abyss-original-expedition-v1',sceneConfig});
  let root=await storage.load(link.worldId),sim=null,busy=false,error='',saved='idle',closed=false,inFlight=null;
  const idleWaiters=[];
  let lastCheckpoint=0,nextSpawn=0,spawnCursor=0,paths=new Map();
  const actor=(id,state=root)=>state?.combat.actors.find(x=>x.id===id);
  const alive=(id,state=root)=>Number(actor(id,state)?.hp)>0;
  const ctx=()=>getContext();
  const physicianAt=()=>{const current=ctx();return Object.hasOwn(current,'physicianPosition')?current.physicianPosition:PHYSICIAN;};
  const atCamp=p=>distance(p,world.safePoint)<world.safePoint.radius;
  const foot=()=>{const c=ctx();return !c.mounted&&!c.airborne&&!c.dashing;};
  const active=()=>ctx().playing&&foot()&&alive(link.playerId);
  const flightCombat=()=>{const c=ctx();return c.playing&&!c.remote&&c.flying===true&&c.combatZone===true&&Number.isFinite(c.player?.y)&&!c.mounted&&!c.dashing&&Number(actor(link.playerId)?.realm)>=4&&alive(link.playerId);};
  const combatActive=()=>active()||flightCombat();
  const meleeCombat=()=>!ctx().remote&&(active()||flightCombat());
  const body=p=>combatBody(p,queries.terrainHeight);
  const enemyBolt=Object.freeze({id:'expedition-scavenger-bolt',kind:'basic',minimumRealm:0,channel:'physical',weights:['1'],maxTargets:1});
  const clear=(a,b)=>queries.canTraverse(a,b,.65)&&!queries.dynamicBlocked(b);
  function sourceForMember(id,state=root) {
    for(const [anchorId,slot] of Object.entries(state.director.anchors)){
      if(slot.current?.members.some(m=>m.instanceId===id))return rules.entries.find(e=>e.id===anchorId);
      for(const old of slot.history||[])if(old.members?.some(m=>m.instanceId===id))return rules.entries.find(e=>e.id===anchorId);
    }
    return null;
  }
  function syncPositions() {
    // Old R8 scenes have no melee extension. Hydrate after every load, including CAS recovery.
    sim.aerialMelee??={combo:0,lastContact:-1e9,guarding:false,guardSince:-1e9,guardYaw:0,guardMeter:0,guardBreakUntil:0,stunUntil:0,counterUntil:0,events:[],opponents:{}};
    sim.riftwings??={};
    for(const slot of Object.values(root.director.anchors)) for(const member of slot.current?.members||[]){
      const def=sourceForMember(member.instanceId);if(def&&!sim.enemies[member.instanceId])sim.enemies[member.instanceId]={x:def.x,z:def.z,yaw:0,...(def.id===ARENA_ID?{y:queries.terrainHeight(def.x,def.z)+12}:{})};
      if(def?.id===ARENA_ID&&sim.enemies[member.instanceId]&&!Number.isFinite(sim.enemies[member.instanceId].y))sim.enemies[member.instanceId].y=queries.terrainHeight(sim.enemies[member.instanceId].x,sim.enemies[member.instanceId].z)+12;
      if(def?.id===RIFTWING_ID){
        sim.enemies[member.instanceId].y??=queries.terrainHeight(sim.enemies[member.instanceId].x,sim.enemies[member.instanceId].z);
        sim.riftwings[member.instanceId]??=initialRiftwingState();
      }
    }
    // Keep every corpse that still holds items. Empty previous generations need no spatial entry.
    const current=new Set(Object.values(root.director.anchors).flatMap(s=>(s.current?.members||[]).map(m=>m.instanceId)));
    for(const id of Object.keys(sim.enemies))if(!current.has(id)&&!count(root,root.drops.find(d=>d.memberId===id)?.container.containerId))delete sim.enemies[id];
    for(const id of Object.keys(sim.riftwings))if(!sim.enemies[id])delete sim.riftwings[id];
    for(const id of paths.keys())if(!sim.enemies[id]||!alive(id))paths.delete(id);
  }
  function scene() {return {...clone(sim),player:pose(ctx().player)};}
  function spatialQuery(plan) {
    const def=rules.entries.find(e=>e.id===plan.anchorId),p=ctx().player;
    if(!def)return {};
    const corpses=root?.drops.filter(d=>d.created&&count(root,d.container.containerId)>0)||[];
    const near=corpses.filter(d=>sim?.enemies[d.memberId]&&distance(sim.enemies[d.memberId],def)<12);
    const site=def.id===ARENA_ID?ARENA_SITE:def.id===RIFTWING_ID?RIFTWING_SITE:world.sites.find(s=>s.id===def.siteId);
    const supported=Number.isFinite(queries.terrainHeight(def.x,def.z));
    return {ecologyAllowed:!!site&&distance(site,def)<site.radius,groundSupported:supported,
      collisionFree:queries.canOccupy(def,def.id===RIFTWING_ID?RIFTWING_ENVELOPE.groundRadius:.65)&&!queries.dynamicBlocked(def,def.id===RIFTWING_ID?RIFTWING_ENVELOPE.groundRadius:.65),
      reachable:!!site&&([ARENA_ID,RIFTWING_ID].includes(def.id)||queries.canTraverse(site,def,.65)),pathClear:!!site&&([ARENA_ID,RIFTWING_ID].includes(def.id)||queries.canTraverse(site,def,.65)),
      outsideProtectedVolumes:!atCamp(def),budgetAllowed:Object.keys(sim?.enemies||{}).length<16,
      corpseClear:near.length===0,playerDistance:arena&&[ARENA_ID,RIFTWING_ID].includes(def.id)?100:distance(p,def),visible:arena&&[ARENA_ID,RIFTWING_ID].includes(def.id)?false:isVisible?isVisible(body(def)):distance(p,def)<140,
      unsettledLootContainers:near.length,placementId:def.id};
  }
  if(!root&&link.initialized){storage.close();throw Error('关联外勤根记录缺失，已停止初始化以避免重复奖励');}
  if(!root){const initial=initialRoot(link,rules,spatialQuery);await storage.initialize(initial);root=await storage.load(link.worldId);}
  sim=root.scene?clone(root.scene):{version:1,time:root.simTime,player:pose(ctx().player),enemies:{},pending:{},cooldowns:{},hurt:{},logs:[]};
  syncPositions();
  // A held key is never restored from disk; a saved guard must require a fresh keydown.
  let guardHeld=false;sim.aerialMelee.guarding=false;
  let meleeBuffer=null;
  lastCheckpoint=sim.time;
  const skills=createSkillBridge({getRoot:()=>root,getContext:ctx,getScene:()=>sim,playerId:link.playerId,queries,issue,getPalm,isBusy:()=>busy,protectedPoint:atCamp});
  const session=createSession({storage,definitions:rules.definitions,materialize:rules.materialize,spatialQuery,sceneConfig,authorize,skillGeometry:skills.geometry});
  root=await session.load(link.worldId); // Configuration mismatch is a hard error, never a reset.
  let checkpointClient=checkpointStorageName?await createCheckpointClient({name:checkpointStorageName,sceneConfig,definitions:rules.definitions}):null;
  saved='saved';
  const progression=createProgressionRuntime({getRoot:()=>root,getContext:ctx,playerId:link.playerId,issue:(kind,fields)=>issue(kind,{...fields,scene:scene()}),lineOfSight:(a,b)=>queries.hasLineOfSight(body(a),body(b))});
  link.initialized=true;
  function nearest(state=root) {
    if(!state||!foot())return null;
    const p=ctx().player,points=[];
    for(const def of world.resources){const inst=state.director.anchors[def.id]?.current;
      if(!inst)continue;const c=state.inventory.containers.find(c=>c.sourceInstanceId===inst.instanceId);
      points.push({...def,containerId:c?.containerId,remaining:c?count(state,c.containerId):0,action:'harvest'});
    }
    for(const d of state.drops.filter(d=>d.created)){
      const loc=sim.enemies[d.memberId],rift=sourceForMember(d.memberId,state)?.id===RIFTWING_ID;
      // A winged corpse falls through the persisted simulation before its
      // single committed drop can be collected on the ground.
      if(loc&&(!rift||(loc.y??queries.terrainHeight(loc.x,loc.z))<=queries.terrainHeight(loc.x,loc.z)+.1))
        points.push({...loc,id:d.memberId,name:rift?'裂翼巡猎兽遗留物':'掠兽遗留物',containerId:d.container.containerId,remaining:count(state,d.container.containerId),action:'loot'});
    }
    return points.filter(x=>distance(x,p)<3.2&&queries.hasLineOfSight(body(p),body(x))).sort((a,b)=>distance(a,p)-distance(b,p))[0]||null;
  }
  function authorize(state,request) {
    if(!inFlight||canonical(request)!==canonical(inFlight)||closed)return false;
    const p=ctx().player;
    if(request.kind==='exploration')return alive(link.playerId,state)&&explorationAccess(state,request)===true;
    if(ctx().remote&&request.kind!=='checkpoint')return false;
    if(request.kind==='skill')return !ctx().menu&&skills.authorize(state,request);
    if(request.kind==='checkpoint')return true;
    if(request.kind==='spawn'){
      if(request.anchorId===RIFTWING_ID&&state.director.anchors[RIFTWING_ID]?.generation>=0)return false;
      return arena&&[ARENA_ID,RIFTWING_ID].includes(request.anchorId)||!ctx().menu&&ctx().playing;
    }
    if(request.kind==='rescue')return Number(actor(link.playerId,state)?.hp)===0;
    if(request.kind==='progression')return progression.authorize(state,request);
    if(request.kind==='camp'){
      const action=request.camp?.action;
      if(!alive(link.playerId,state))return false;
      if(action==='heal')return ctx().playing&&!ctx().menu;
      if(action==='use-cancel')return true;
      if(action==='use-start'||action==='use-finish')return active()&&!ctx().menu&&!ctx().skillMenu&&!ctx().prone&&!sim.pending[link.playerId]&&!skills.busy()&&!ctx().sprinting;
      const physician=physicianAt();return !!physician&&(ctx().playing||ctx().menu)&&foot()&&distance(p,physician)<=physician.radius&&queries.hasLineOfSight(body(p),body(physician));
    }
    if(request.kind==='transfer'){
      if(!alive(link.playerId,state)||!foot())return false;
      return request.operations.every(op=>{
        const item=state.inventory.items.find(x=>x.itemInstanceId===op.itemInstanceId&&x.containerId===op.fromContainerId);
        if(!item||item.status!=='normal'||op.quantity!==1)return false;
        if([op.fromContainerId,op.toContainerId].every(x=>[PACK,CAMP].includes(x)))return atCamp(p);
        const near=nearest(state);return ctx().playing&&!ctx().menu&&near?.remaining>0&&near.containerId===op.fromContainerId&&op.toContainerId===PACK;
      });
    }
    if(!combatActive()||ctx().menu)return false;
    if(request.kind==='cast'){
      const source=request.cast.sourceId,pending=request.scene?.pending[source];
      const meleeName=meleeMoveForKind(pending?.kind),melee=meleeName&&AIR_MELEE[meleeName];
      const wing=pending?.kind&&riftwingAttack(pending.kind),aerial=pending?.kind&&!wing&&pending.kind!=='scavenger-bolt'?airAttackForRealm(Number(actor(link.playerId,state)?.realm)):null;
      const expected=melee?meleeSkill(meleeName):wing?riftwingSkill(wing):pending?.kind==='scavenger-bolt'?enemyBolt:aerial&&aerial.kind===pending?.kind?airSkill(aerial):ATTACK;
      if(canonical(request.cast.skill)!==canonical(expected)||!alive(source,state)||!pending||pending.start!==request.simTime)return false;
      if(melee){if(!meleeCombat()||(meleeName==='lunge'?source===link.playerId||sourceForMember(source)?.id!==ARENA_ID:source!==link.playerId))return false;}
      else if(wing){if(source===link.playerId||sourceForMember(source)?.id!==RIFTWING_ID||!meleeCombat())return false;}
      else if(pending.kind&&(!flightCombat()||pending.kind==='scavenger-bolt'&&source===link.playerId||pending.kind!=='scavenger-bolt'&&source!==link.playerId))return false;
      if((sim.cooldowns[source]||0)>sim.time)return false;
      return source===link.playerId||(!atCamp(p)&&sim.enemies[source]&&(wing?
        Math.hypot(...['x','y','z'].map(k=>body(sim.enemies[source])[k]-body(p)[k]))<=wing.reach+3&&queries.hasLineOfSight(body(sim.enemies[source]),body(p)):
        pending.kind==='scavenger-bolt'?Math.hypot(...['x','y','z'].map(k=>body(sim.enemies[source])[k]-body(p)[k]))<=BOLT_REACH&&queries.hasLineOfSight(body(sim.enemies[source]),body(p)):
          canBeginCreatureAttack(body(sim.enemies[source]),body(p),TIMING.enemy.reach,queries.hasLineOfSight)));
    }
    if(request.kind==='hit'){
      const hits=request.hits||[request.hit];
      if(!Array.isArray(hits)||hits.length<1||hits.length>12||new Set(hits.map(h=>h.targetId)).size!==hits.length)return false;
      const cast=state.combat.casts.find(c=>c.castId===hits[0].castId),pending=cast&&sim.pending[cast.sourceId];
      if(!cast||!pending||pending.resolved||sim.time<pending.due||sim.time>pending.end||!alive(cast.sourceId,state)||hits.some(h=>h.castId!==cast.castId||!alive(h.targetId,state)))return false;
      const playerAttack=cast.sourceId===link.playerId,from=playerAttack?p:sim.enemies[cast.sourceId];
      if(!from||atCamp(from))return false;
      const meleeName=meleeMoveForKind(pending.kind);
      if(meleeName){
        if(!meleeCombat()||hits.length!==1||(meleeName==='lunge')===playerAttack)return false;
        const to=playerAttack?sim.enemies[hits[0].targetId]:p;
        if(!to||!alive(hits[0].targetId,state)||atCamp(to)||!meleeContact(from,to,pending.yaw,AIR_MELEE[meleeName],queries.hasLineOfSight,queries.terrainHeight))return false;
        const guard=playerAttack?sim.aerialMelee.opponents[hits[0].targetId]:sim.aerialMelee;
        return (!playerAttack||hits[0].targetId!==link.playerId)&& (playerAttack||hits[0].targetId===link.playerId)&&
          !['block','parry'].includes(guardedImpact(guard||{},from,to,sim.time,queries.terrainHeight).kind);
      }
      const wing=riftwingAttack(pending.kind);
      if(wing)return !playerAttack&&sourceForMember(cast.sourceId)?.id===RIFTWING_ID&&hits.length===1&&
        hits[0].targetId===link.playerId&&meleeCombat()&&!atCamp(p)&&riftwingContact(from,p,pending.yaw,wing,queries);
      if(pending.kind){
        if(!flightCombat())return false;
        if(pending.kind==='scavenger-bolt')return !playerAttack&&hits.length===1&&hits[0].targetId===link.playerId&&!atCamp(p)&&boltHitsAim(from,p,pending.aim,queries.terrainHeight,queries.hasLineOfSight);
        const attack=airAttackForRealm(Number(actor(link.playerId,state)?.realm));
        if(!playerAttack||!attack||attack.kind!==pending.kind)return false;
        const eligible=airTargets({from,enemies:Object.entries(sim.enemies).filter(([id])=>alive(id,state)&&!atCamp(sim.enemies[id])),body,aim:{yaw:pending.yaw,pitch:pending.pitch,position:pending.aim},attack,lineOfSight:queries.hasLineOfSight});
        return hits.length===eligible.length&&hits.every((h,i)=>h.targetId===eligible[i].id);
      }
      if(hits.length!==1)return false;
      const to=playerAttack?sim.enemies[hits[0].targetId]:p;
      return !!to&&!atCamp(to)&&(!playerAttack?hits[0].targetId===link.playerId:true)&&canHit(body(from),body(to),pending.yaw,TIMING[playerAttack?'player':'enemy'].reach,queries.hasLineOfSight);
    }
    return false;
  }
  async function issue(kind,fields={}) {
    if(busy||closed)return false;
    busy=true;error='';saved='saving';onChange();
    const request={worldId:link.worldId,transactionId:makeId(),expectedRevision:root.revision,simTime:sim.time,kind,...fields};
    inFlight=clone(request);
    try{
      const result=await (kind==='checkpoint'&&checkpointClient?checkpointClient:session).execute(request);root=result.state;
      if(root.scene)sim=clone(root.scene);syncPositions();saved='saved';lastCheckpoint=sim.time;return true;
    }catch(e){
      if(kind==='checkpoint'&&checkpointClient){checkpointClient.close();checkpointClient=null;}
      error=messages[e.code||e.message]||('操作未完成：'+e.message);saved='error';
      try{root=await session.load(link.worldId);if(root.scene)sim=clone(root.scene);syncPositions();}catch(loadError){error+='；读取失败：'+loadError.message;}
      return false;
    }finally{busy=false;inFlight=null;if(!guardHeld)sim.aerialMelee.guarding=false;onChange();for(const resolve of idleWaiters.splice(0))resolve();if(meleeBuffer)queueMicrotask(tryConsumeMeleeBuffer);}
  }
  function log(text){sim.logs.push({time:sim.time,text});sim.logs=sim.logs.slice(-8);}
  function meleeInputAllowed(){const c=ctx();return !closed&&meleeCombat()&&!c.menu&&!c.skillMenu&&
    !sim.aerialMelee.guarding&&sim.aerialMelee.stunUntil<=sim.time;}
  function tryConsumeMeleeBuffer(){
    if(!meleeBuffer)return false;
    if(clockMs()>meleeBuffer.expiresAt||!meleeInputAllowed()){meleeBuffer=null;return false;}
    if(meleeBuffer.followCastId&&!root.combat.casts.some(c=>c.castId===meleeBuffer.followCastId)&&!busy){meleeBuffer=null;return false;}
    if(busy)return false;
    const pending=sim.pending[link.playerId];
    if(pending){if(!meleeMoveForKind(pending.kind)){meleeBuffer=null;return false;}return false;}
    if((sim.cooldowns[link.playerId]||0)>sim.time)return false;
    meleeBuffer=null;
    const next=nextMeleeMove(sim.aerialMelee.combo,sim.aerialMelee.lastContact,sim.time,sim.aerialMelee.counterUntil>sim.time);
    void cast(link.playerId,next.move).then(committed=>{if(committed&&next.move==='uppercut')sim.aerialMelee.counterUntil=0;});
    return true;
  }
  function meleeEvent(target,kind,sourceId,targetId,position,direction,start,end,id=makeId()){
    target.events.push({id,kind,sourceId,targetId:targetId||'',position:{x:position.x,y:position.y,z:position.z},direction:{x:direction.x,y:direction.y,z:direction.z},start,end});
    target.events=target.events.slice(-24);
  }
  const opponentState=(id,state=sim.aerialMelee)=>state.opponents[id]??={guarding:false,guardSince:-1e9,guardYaw:0,guardMeter:0,guardBreakUntil:0,stunUntil:0,reactUntil:0,impulseX:0,impulseY:0,impulseZ:0,impulseStart:0,impulseEnd:0,impulseApplied:0};
  async function cast(sourceId,meleeName=null) {
    if(busy||!combatActive()||ctx().menu||ctx().skillMenu||(sourceId===link.playerId&&skills.busy())||(sim.cooldowns[sourceId]||0)>sim.time||sim.pending[sourceId]||(sourceId===link.playerId&&campState(root).use))return false;
    const type=sourceId===link.playerId?'player':'enemy',aerial=flightCombat(),melee=meleeName&&AIR_MELEE[meleeName],
      wing=type==='enemy'&&sourceForMember(sourceId)?.id===RIFTWING_ID?
        (sim.riftwings[sourceId]?.mode==='air'?
          sim.time-sim.riftwings[sourceId].modeSince<1.5||
          Math.hypot(sim.enemies[sourceId].x-ctx().player.x,(sim.enemies[sourceId].y??0)-(ctx().player.y??0),sim.enemies[sourceId].z-ctx().player.z)>3?
            RIFTWING_ATTACKS.dive:RIFTWING_ATTACKS.sweep:sim.riftwings[sourceId]?.mode==='ground'?RIFTWING_ATTACKS.claw:null):null;
    if(type==='enemy'&&sourceForMember(sourceId)?.id===RIFTWING_ID&&!wing)return false;
    if(type==='player'&&meleeCombat()&&(sim.aerialMelee.stunUntil>sim.time||sim.aerialMelee.guarding))return false;
    if(melee&&(!meleeCombat()||type==='player'&&meleeName==='lunge'||type==='enemy'&&(meleeName!=='lunge'||sourceForMember(sourceId)?.id!==ARENA_ID)||
      (type==='player'?sim.aerialMelee.stunUntil:opponentState(sourceId).stunUntil)>sim.time||type==='player'&&sim.aerialMelee.guarding))return false;
    if(wing&&sim.riftwings[sourceId]?.stunUntil>sim.time)return false;
    const attack=type==='player'&&aerial&&!melee?airAttackForRealm(Number(actor(link.playerId)?.realm)):null;
    const timing=melee||wing||attack?{windup:(melee||wing||attack).windup,recovery:(melee||wing||attack).recovery}:type==='enemy'&&aerial?{windup:1.15,recovery:1.1}:TIMING[type],id=makeId(),next=scene();
    const from=type==='player'?ctx().player:sim.enemies[sourceId],target=ctx().player;
    const yaw=type==='player'?angle(from.yaw):Math.atan2(from.x-target.x,from.z-target.z);
    if(type==='enemy')next.enemies[sourceId].yaw=yaw;
    const pending={castId:id,start:sim.time,due:sim.time+timing.windup,end:sim.time+timing.windup+timing.recovery,yaw,committed:true,resolved:false};
    if(aerial||melee||wing){
      const origin=body(from),to=body(target),pitch=Math.max(-1.35,Math.min(1.35,type==='player'?angle(from.pitch||0):Math.atan2(to.y-origin.y,Math.hypot(to.x-origin.x,to.z-origin.z))));
      let aim=to;
      if(attack){
        const candidates=Object.entries(sim.enemies).filter(([enemyId])=>alive(enemyId)&&!atCamp(sim.enemies[enemyId])).map(([,position])=>body(position))
          .map(position=>({position,along:rayContact(origin,position,yaw,pitch,attack.reach,attack.radius+.35)}))
          .filter(hit=>hit.along!==null&&queries.hasLineOfSight(origin,hit.position)).sort((a,b)=>a.along-b.along);
        aim=candidates[0]?.position||aimedPoint(origin,yaw,pitch,attack.reach);
      }
      Object.assign(pending,{kind:melee?.kind||wing?.kind||attack?.kind||'scavenger-bolt',pitch,origin:{x:origin.x,y:origin.y,z:origin.z},aim:{x:aim.x,y:aim.y,z:aim.z}});
      if(melee){const direction={x:aim.x-origin.x,y:aim.y-origin.y,z:aim.z-origin.z},length=Math.hypot(direction.x,direction.y,direction.z)||1;
        meleeEvent(next.aerialMelee,meleeName,sourceId,'',origin,{x:direction.x/length,y:direction.y/length,z:direction.z/length},sim.time,pending.end,id);
      }
    }
    next.pending[sourceId]=pending;
    next.cooldowns[sourceId]=next.pending[sourceId].end;
    return issue('cast',{cast:{worldId:link.worldId,sourceId,castId:id,skill:melee?meleeSkill(meleeName):wing?riftwingSkill(wing):attack?airSkill(attack):aerial?enemyBolt:ATTACK},scene:next});
  }
  async function resolve(sourceId,pending) {
    const playerAttack=sourceId===link.playerId,from=playerAttack?ctx().player:sim.enemies[sourceId];
    const meleeName=meleeMoveForKind(pending.kind);
    if(meleeName){
      const move=AIR_MELEE[meleeName],ids=playerAttack?Object.keys(sim.enemies).filter(id=>alive(id)&&!atCamp(sim.enemies[id])):[link.playerId];
      const target=ids.find(id=>{const to=playerAttack?sim.enemies[id]:ctx().player;return meleeContact(from,to,pending.yaw,move,queries.hasLineOfSight,queries.terrainHeight);});
      const next=scene();next.pending[sourceId].resolved=true;
      if(playerAttack){next.aerialMelee.combo=meleeName==='jab'?1:meleeName==='cross'?2:3;next.aerialMelee.lastContact=sim.time;}
      if(!target||!meleeCombat()){
        meleeEvent(next.aerialMelee,'whiff',sourceId,'',body(from),{x:0,y:0,z:0},sim.time,sim.time+.22);
        await issue('checkpoint',{scene:next});return;
      }
      const to=playerAttack?sim.enemies[target]:ctx().player,wingTarget=playerAttack&&sourceForMember(target)?.id===RIFTWING_ID,
        defense=playerAttack?(wingTarget?{}:opponentState(target,next.aerialMelee)):next.aerialMelee;
      const guard=guardedImpact(defense,from,to,sim.time,queries.terrainHeight);
      if(guard.kind==='block'||guard.kind==='parry'){
        defense.guardMeter=guard.meter;
        if(guard.kind==='parry'){const attackState=playerAttack?opponentState(target,next.aerialMelee):next.aerialMelee;
          if(playerAttack){next.aerialMelee.stunUntil=sim.time+.55;next.aerialMelee.combo=0;}
          else {attackState.counterUntil=sim.time+.7;const recoil=meleeImpulse(to,from,move,queries.terrainHeight),opponent=opponentState(sourceId,next.aerialMelee);
            Object.assign(opponent,{stunUntil:sim.time+.55,impulseX:recoil.dx*.6,impulseY:recoil.dy*.6,impulseZ:recoil.dz*.6,impulseStart:sim.time,impulseEnd:sim.time+.55,impulseApplied:0,reactUntil:sim.time+.55});}
        }
        const recoil=guard.kind==='parry'?meleeImpulse(to,from,move,queries.terrainHeight):meleeImpulse(from,to,move,queries.terrainHeight);
        meleeEvent(next.aerialMelee,guard.kind,guard.kind==='parry'?target:sourceId,guard.kind==='parry'?sourceId:target,body(guard.kind==='parry'?from:to),{x:recoil.dx,y:recoil.dy,z:recoil.dz},sim.time,sim.time+.45);
        if(await issue('checkpoint',{scene:next})&&guard.kind==='parry'&&playerAttack){const v=meleeImpulse(to,from,move,queries.terrainHeight);onAirImpulse({id:pending.castId+':parry',sourceId:target,dx:v.dx,dy:v.dy,dz:v.dz,units:'metres',kind:'parry'});}
        return;
      }
      if(guard.kind==='break'){
        defense.guarding=false;defense.guardMeter=0;defense.guardBreakUntil=sim.time+1.25;
        meleeEvent(next.aerialMelee,'guardbreak',sourceId,target,body(to),{x:0,y:0,z:0},sim.time,sim.time+.5);
      }
      const impulse=meleeImpulse(from,to,move,queries.terrainHeight);
      next.hurt[target]=sim.time+.38;
      if(next.pending[target]&&!next.pending[target].resolved&&(meleeMoveForKind(next.pending[target].kind)||isRiftwingKind(next.pending[target].kind)))next.pending[target].resolved=true;
      if(playerAttack){
        const reaction=wingTarget?next.riftwings[target]:opponentState(target,next.aerialMelee);
        Object.assign(reaction,{impulseX:impulse.dx,impulseY:impulse.dy,impulseZ:impulse.dz,impulseStart:sim.time,impulseEnd:sim.time+.55,impulseApplied:0,stunUntil:sim.time+.55});
        if(wingTarget){reaction.aggroUntil=sim.time+8;if(move.launch&&reaction.mode==='ground')reaction.mode='takeoff';}
        else reaction.reactUntil=sim.time+.55;
      }else next.aerialMelee.stunUntil=sim.time+.45;
      meleeEvent(next.aerialMelee,move.launch?'launch':'impact',sourceId,target,body(to),{x:impulse.dx,y:impulse.dy,z:impulse.dz},sim.time,sim.time+.55);
      const hit={worldId:link.worldId,castId:pending.castId,hitId:makeId(),targetId:target,segment:0,barrierIds:skills.incoming(target,body(from),body(to))};
      if(await issue('hit',{hit,scene:next})){
        if(!playerAttack)onAirImpulse({id:pending.castId+':hit',sourceId,dx:impulse.dx,dy:impulse.dy,dz:impulse.dz,units:'metres',kind:meleeName});
        log(playerAttack?alive(target)?'连击命中':'敌人倒下，遗留物已保存':'受到空中近身反击');
      }
      return;
    }
    const wing=riftwingAttack(pending.kind);
    if(wing){
      const to=ctx().player,next=scene();next.pending[sourceId].resolved=true;
      if(!playerAttack&&meleeCombat()&&!atCamp(to)&&riftwingContact(from,to,pending.yaw,wing,queries)){
        const dx=to.x-from.x,dz=to.z-from.z,length=Math.hypot(dx,dz)||1,
          recoil={dx:dx/length*(wing.kind===RIFTWING_ATTACKS.dive.kind?1.65:.9),dy:wing.kind===RIFTWING_ATTACKS.dive.kind?.55:.25,dz:dz/length*(wing.kind===RIFTWING_ATTACKS.dive.kind?1.65:.9)};
        next.hurt[link.playerId]=sim.time+.35;
        next.aerialMelee.stunUntil=sim.time+.35;
        meleeEvent(next.aerialMelee,'impact',sourceId,link.playerId,body(to),{x:recoil.dx,y:recoil.dy,z:recoil.dz},sim.time,sim.time+.35);
        const hit={worldId:link.worldId,castId:pending.castId,hitId:makeId(),targetId:link.playerId,segment:0,
          barrierIds:skills.incoming(link.playerId,body(from),body(to))};
        if(await issue('hit',{hit,scene:next})){
          onAirImpulse({id:pending.castId+':hit',sourceId,dx:recoil.dx,dy:recoil.dy,dz:recoil.dz,units:'metres',kind:wing.kind});
          log(wing.kind===RIFTWING_ATTACKS.dive.kind?'裂翼俯冲命中':wing.kind===RIFTWING_ATTACKS.sweep.kind?'裂翼横扫命中':'裂翼爪扑命中');
        }
      }else{meleeEvent(next.aerialMelee,'whiff',sourceId,'',body(from),{x:0,y:0,z:0},sim.time,sim.time+.2);await issue('checkpoint',{scene:next});}
      return;
    }
    if(pending.kind){
      const attack=playerAttack?airAttackForRealm(Number(actor(link.playerId)?.realm)):null;
      const targets=playerAttack&&attack?.kind===pending.kind?
        airTargets({from,enemies:Object.entries(sim.enemies).filter(([id])=>alive(id)&&!atCamp(sim.enemies[id])),body,aim:{yaw:pending.yaw,pitch:pending.pitch,position:pending.aim},attack,lineOfSight:queries.hasLineOfSight}).map(x=>x.id):
        !playerAttack&&boltHitsAim(from,ctx().player,pending.aim,queries.terrainHeight,queries.hasLineOfSight)?[link.playerId]:[];
      if(targets.length&&flightCombat()){
        const next=scene();next.pending[sourceId].resolved=true;for(const target of targets)next.hurt[target]=sim.time+.25;
        if(playerAttack)for(const target of targets)if(sourceForMember(target)?.id===RIFTWING_ID){
          const loc=sim.enemies[target],memory=next.riftwings[target],dx=loc.x-from.x,dz=loc.z-from.z,length=Math.hypot(dx,dz)||1;
          Object.assign(memory,{aggroUntil:sim.time+8,stunUntil:sim.time+.35,impulseX:dx/length*1.1,impulseY:.35,impulseZ:dz/length*1.1,
            impulseStart:sim.time,impulseEnd:sim.time+.45,impulseApplied:0});
          if(next.pending[target]&&!next.pending[target].resolved&&isRiftwingKind(next.pending[target].kind))next.pending[target].resolved=true;
        }
        const hits=targets.map(target=>({worldId:link.worldId,castId:pending.castId,hitId:makeId(),targetId:target,segment:0,
          barrierIds:skills.incoming(target,body(from),body(playerAttack?sim.enemies[target]:ctx().player))}));
        if(await issue('hit',{hits,scene:next}))log(playerAttack?targets.some(id=>!alive(id))?'破虚命中，掠兽遗留物已保存':'气刃命中掠兽':'受到掠兽远程反击');
      }else{sim.pending[sourceId].resolved=true;log(playerAttack?'空中攻击落空':'掠兽远程攻击落空');await issue('checkpoint',{scene:scene()});}
      return;
    }
    const ids=playerAttack?Object.keys(sim.enemies).filter(id=>alive(id)):[link.playerId];
    const target=ids.find(id=>{const to=playerAttack?sim.enemies[id]:ctx().player;return !atCamp(from)&&!atCamp(to)&&canHit(body(from),body(to),pending.yaw,TIMING[playerAttack?'player':'enemy'].reach,queries.hasLineOfSight);});
    if(target&&active()){
      const next=scene();next.pending[sourceId].resolved=true;next.hurt[target]=sim.time+.25;
      if(playerAttack&&sourceForMember(target)?.id===RIFTWING_ID){
        const memory=next.riftwings[target],loc=sim.enemies[target],dx=loc.x-from.x,dz=loc.z-from.z,length=Math.hypot(dx,dz)||1;
        Object.assign(memory,{aggroUntil:sim.time+8,stunUntil:sim.time+.3,impulseX:dx/length*.65,impulseY:0,impulseZ:dz/length*.65,
          impulseStart:sim.time,impulseEnd:sim.time+.4,impulseApplied:0});
        if(next.pending[target]&&!next.pending[target].resolved&&isRiftwingKind(next.pending[target].kind))next.pending[target].resolved=true;
      }
      if(await issue('hit',{hit:{worldId:link.worldId,castId:pending.castId,hitId:makeId(),targetId:target,segment:0,barrierIds:skills.incoming(target,body(from),body(playerAttack?sim.enemies[target]:ctx().player))},scene:next})){
        log(playerAttack?(alive(target)?'脉冲命中掠兽':'掠兽倒下，遗留物已保存'):'受到掠兽攻击');
      }
    }else{sim.pending[sourceId].resolved=true;log(playerAttack?'脉冲落空':'掠兽扑击落空');await issue('checkpoint',{scene:scene()});}
  }
  function moveEnemy(id,def,dt) {
    if(def.id===RIFTWING_ID){
      const result=advanceRiftwing({location:sim.enemies[id],state:sim.riftwings[id],player:ctx().player,def,now:sim.time,dt,queries,
        enabled:meleeCombat(),protectedPoint:atCamp,hp:Number(actor(id)?.hp||0),pending:sim.pending[id]});
      sim.enemies[id]=result.location;sim.riftwings[id]=result.state;
      paths.set(id,{behavior:result.pursuing?'chase':result.state.mode==='landing'?'return':'watch',lastMoved:result.state.lastMoved});
      return;
    }
    if(def.id===ARENA_ID&&flightCombat()){
      const enemy=sim.enemies[id],player=ctx().player,state=opponentState(id),dx=player.x-enemy.x,dz=player.z-enemy.z,d=Math.hypot(dx,dz)||1;
      enemy.yaw=angle(Math.atan2(enemy.x-player.x,enemy.z-player.z));
      if(state.impulseEnd>state.impulseStart&&state.impulseApplied<1){
        const progress=Math.max(0,Math.min(1,(sim.time-state.impulseStart)/(state.impulseEnd-state.impulseStart))),eased=1-(1-progress)**2,part=Math.max(0,eased-state.impulseApplied);
        const candidate={x:Math.max(-2999,Math.min(2999,enemy.x+state.impulseX*part)),z:Math.max(-2999,Math.min(2999,enemy.z+state.impulseZ*part)),y:Math.max(queries.terrainHeight(enemy.x,enemy.z)+1.1,(enemy.y??queries.terrainHeight(enemy.x,enemy.z))+state.impulseY*part)};
        if(queries.canOccupy(candidate,.65)&&queries.hasLineOfSight(body(enemy),body(candidate))){Object.assign(enemy,candidate);state.impulseApplied=eased;}
        else state.impulseApplied=1;
      }
      if(state.stunUntil>sim.time||sim.pending[id])return;
      const pace=Math.min(Math.max(0,d-1.3),def.moveSpeed*dt),candidate={x:enemy.x+dx/d*pace,z:enemy.z+dz/d*pace};
      if(pace>0&&queries.canOccupy(candidate,.65)&&queries.hasLineOfSight(body(enemy),body({...candidate,y:enemy.y??queries.terrainHeight(candidate.x,candidate.z)}))){enemy.x=candidate.x;enemy.z=candidate.z;}
      enemy.y=Math.max(queries.terrainHeight(enemy.x,enemy.z)+1.1,(enemy.y??queries.terrainHeight(enemy.x,enemy.z))+Math.max(-def.moveSpeed*dt,Math.min(def.moveSpeed*dt,player.y-(enemy.y??queries.terrainHeight(enemy.x,enemy.z)))));
      const close=Math.hypot(enemy.x-player.x,enemy.y-player.y,enemy.z-player.z)<5.2;
      const guard=close&&!sim.pending[id]&&sim.time>=state.stunUntil&&Math.floor(sim.time/1.45)%3===0&&sim.time>=state.guardBreakUntil;
      if(guard&&!state.guarding)state.guardSince=sim.time;
      state.guarding=guard;state.guardYaw=enemy.yaw;
      return;
    }
    const result=steerCreature({enemy:sim.enemies[id],player:ctx().player,def,now:sim.time,dt,
      enabled:combatActive()&&!ctx().menu,clear,visible:(a,b)=>queries.hasLineOfSight(body(a),body(b)),
      protectedPoint:atCamp,memory:paths.get(id),hp:Number(actor(id)?.hp||0)});
    paths.set(id,result.memory);
  }
  function tick(dt) {
    if(meleeBuffer&&(clockMs()>meleeBuffer.expiresAt||!meleeInputAllowed()))meleeBuffer=null;
    if(!closed&&!busy&&ctx().remote&&Object.values(sim.pending).some(p=>p.kind&&!p.resolved)){
      for(const pending of Object.values(sim.pending))if(pending.kind)pending.resolved=true;
      log('离开盆地战斗区，空中招式已取消');void issue('checkpoint',{scene:scene()});return;
    }
    if(closed||busy)return;
    if(!meleeCombat()||ctx().menu||ctx().skillMenu)sim.aerialMelee.guarding=false;
    if(!ctx().playing||ctx().menu||ctx().skillMenu||!alive(link.playerId))return;
    sim.time+=Math.min(dt,.05);sim.player=pose(ctx().player);
    if(sim.aerialMelee.guarding)sim.aerialMelee.guardYaw=angle(ctx().player.yaw);
    sim.aerialMelee.events=sim.aerialMelee.events.filter(e=>e.end+1>=sim.time);
    if(progression.tick(sim.time))return;
    const medical=campState(root);
    if(medical.use){
      if(!foot()||ctx().sprinting||Number(actor(link.playerId).hp)<medical.use.hpAtStart){void issue('camp',{camp:{action:'use-cancel'},scene:scene()});return;}
      if(sim.time>=medical.use.dueAt){void issue('camp',{camp:{action:'use-finish'},scene:scene()});return;}
    }
    if(medical.heal&&Math.floor(medical.heal.total*Math.min(1,(sim.time-medical.heal.start)/5))>medical.heal.applied){void issue('camp',{camp:{action:'heal'},scene:scene()});return;}
    for(const [id,p] of Object.entries(sim.pending)){
      if(!alive(id)){delete sim.pending[id];continue;}
      if(!p.resolved&&sim.time>=p.due){void resolve(id,p);return;}
      if(sim.time>=p.end)delete sim.pending[id];
    }
    if(tryConsumeMeleeBuffer()||busy)return;
    for(const id of Object.keys(sim.enemies)){
      const def=sourceForMember(id);if(!def)continue;
      if(!alive(id)){
        if(def.id===RIFTWING_ID){
          const loc=sim.enemies[id],state=sim.riftwings[id]??initialRiftwingState(),floor=queries.terrainHeight(loc.x,loc.z);
          if(state.mode!=='dead'){state.mode='dead';state.modeSince=sim.time;}
          if(Number.isFinite(loc.y)&&Number.isFinite(floor)&&loc.y>floor+.18){
            const to={...loc,y:Math.max(floor+.18,loc.y-14*Math.min(dt,.05))};
            if(queries.canAirTraverse?.(loc,to,RIFTWING_ENVELOPE.airRadius,RIFTWING_ENVELOPE.height)){loc.y=to.y;state.lastMoved=sim.time;}
          }
          if(Number.isFinite(floor)&&loc.y<=floor+.18)loc.y=floor;
          sim.riftwings[id]=state;
        }
        continue;
      }
      if(def.id===ARENA_ID)moveEnemy(id,def,Math.min(dt,.05));
      if(def.id===RIFTWING_ID)moveEnemy(id,def,Math.min(dt,.05));
      if(sim.pending[id])continue;
      if(def.id!==ARENA_ID&&def.id!==RIFTWING_ID)moveEnemy(id,def,Math.min(dt,.05));
      const ranged=flightCombat(),sparring=sourceForMember(id)?.id===ARENA_ID;
      const enemyBody=body(sim.enemies[id]),playerBody=body(ctx().player);
      const wing=def.id===RIFTWING_ID,wingMode=sim.riftwings[id]?.mode,wingReady=!wing||wingMode==='ground'||wingMode==='air',
        wingMove=wing?(wingMode==='air'?RIFTWING_ATTACKS.dive:RIFTWING_ATTACKS.claw):null;
      const inReach=wing?Math.hypot(enemyBody.x-playerBody.x,enemyBody.y-playerBody.y,enemyBody.z-playerBody.z)<=wingMove.reach+(wingMove===RIFTWING_ATTACKS.dive?2.5:.5)&&
        queries.hasLineOfSight(enemyBody,playerBody):ranged?Math.hypot(enemyBody.x-playerBody.x,enemyBody.y-playerBody.y,enemyBody.z-playerBody.z)<=(sparring?AIR_MELEE.lunge.reach:BOLT_REACH)&&(!sparring||Math.abs(enemyBody.y-playerBody.y)<.2)&&queries.hasLineOfSight(enemyBody,playerBody):canBeginCreatureAttack(enemyBody,playerBody,TIMING.enemy.reach,queries.hasLineOfSight);
      if(wingReady&&(sparring&&ranged&&!opponentState(id).guarding||paths.get(id)?.behavior==='chase')&&(wing?meleeCombat():combatActive())&&!atCamp(ctx().player)&&inReach&&!(sim.cooldowns[id]>sim.time)){void cast(id,sparring&&ranged?'lunge':null);return;}
    }
    if(skills.tick())return;
    if(sim.time>=nextSpawn){
      nextSpawn=sim.time+1;const anchor=rules.entries[spawnCursor++%rules.entries.length];
      const slot=root.director.anchors[anchor.id];
      if(!(anchor.id===RIFTWING_ID&&(arena||slot?.generation>=0))&&(!slot||slot.generation<0||slot.token?.dueAt<=sim.time)){
        const q=spatialQuery({anchorId:anchor.id});
        if(anchor.id!==ARENA_ID&&q.collisionFree&&q.corpseClear&&q.budgetAllowed&&!q.visible&&(anchor.kind!=='monster'||q.playerDistance>=45)){void issue('spawn',{anchorId:anchor.id,scene:scene()});return;}
      }
    }
    if(sim.time-lastCheckpoint>=2)void issue('checkpoint',{scene:scene()});
  }
  async function action(action) {
    if(action.type==='air-guard'){
      meleeBuffer=null;
      if(action.held!==true){guardHeld=false;sim.aerialMelee.guarding=false;if(!busy&&!closed&&!ctx().remote)return issue('checkpoint',{scene:scene()});return true;}
      if(busy||closed||!meleeCombat()||ctx().menu||ctx().skillMenu||sim.pending[link.playerId]||sim.aerialMelee.stunUntil>sim.time||sim.aerialMelee.guardBreakUntil>sim.time)return false;
      guardHeld=true;
      if(!sim.aerialMelee.guarding){sim.aerialMelee.guarding=true;sim.aerialMelee.guardSince=sim.time;sim.aerialMelee.guardYaw=angle(ctx().player.yaw);}
      return issue('checkpoint',{scene:scene()});
    }
    if(action.type==='air-melee'){
      if(action.repeat===true||!meleeInputAllowed())return false;
      const pending=sim.pending[link.playerId]||inFlight?.scene?.pending?.[link.playerId];
      const following=!!pending&&!!meleeMoveForKind(pending.kind)&&pending.end>sim.time;
      const buffering=busy?['checkpoint','spawn'].includes(inFlight?.kind)||following&&['cast','hit'].includes(inFlight?.kind):following;
      if(buffering){
        if(meleeBuffer)return false;
        const lifetime=following?Math.min(1000,Math.max(250,(pending.end-sim.time)*1000+180)):250;
        meleeBuffer={expiresAt:clockMs()+lifetime,followCastId:following?pending.castId:null};return true;
      }
      if(busy||pending||(sim.cooldowns[link.playerId]||0)>sim.time)return false;
      const next=nextMeleeMove(sim.aerialMelee.combo,sim.aerialMelee.lastContact,sim.time,sim.aerialMelee.counterUntil>sim.time);
      const committed=await cast(link.playerId,next.move);if(committed&&next.move==='uppercut')sim.aerialMelee.counterUntil=0;return committed;
    }
    if(busy||closed)return;
    if(action.type==='air-sparring'){
      if(!arena)return false;
      if(Object.keys(sim.enemies).some(id=>sourceForMember(id)?.id===ARENA_ID&&alive(id)))return true;
      return issue('spawn',{anchorId:ARENA_ID,scene:scene()});
    }
    if(action.type==='riftwing-encounter'){
      if(!arena)return false;
      const slot=root.director.anchors[RIFTWING_ID];
      if(slot?.generation>=0)return Object.keys(sim.enemies).some(id=>sourceForMember(id)?.id===RIFTWING_ID&&alive(id));
      return issue('spawn',{anchorId:RIFTWING_ID,scene:scene()});
    }
    if(action.type==='progression')return progression.action(action.progression);
    if(action.type==='skill-cast'&&flightCombat()&&(sim.aerialMelee.stunUntil>sim.time||sim.aerialMelee.guarding))return false;
    if(action.type==='skill-cast'||action.type==='skill-manage')return skills.action(action);
    if(action.type==='camp')return issue('camp',{camp:{...Object.fromEntries(Object.entries(action.camp||{}).filter(([,v])=>v!==undefined)),wallTime:Date.now()},scene:scene()});
    if(action.type==='attack'||action.type==='skill')return cast(link.playerId);
    if(action.type==='rescue'){
      meleeBuffer=null;
      if(await issue('rescue')){paths.clear();link.rescueRevision=root.revision;onRescue(clone(root.scene.player),root.revision);}
      return;
    }
    let item,target;
    if(action.type==='interact'){
      const near=nearest();if(!near||!near.remaining){error=near?'这里已采尽，没有可领取物资。':'靠近资源或遗留物后按 H。';onChange();return;}
      item=root.inventory.items.find(x=>x.containerId===near.containerId);target=PACK;
    }else if(action.type==='store'||action.type==='take'){
      item=root.inventory.items.find(x=>x.itemInstanceId===action.id&&x.containerId===(action.type==='store'?PACK:CAMP));target=action.type==='store'?CAMP:PACK;
    }
    if(item){await issue('transfer',{operations:[{kind:'transfer',itemInstanceId:item.itemInstanceId,fromContainerId:item.containerId,toContainerId:target,quantity:1}],scene:scene()});}
  }
  function campView(){
    const c=campState(root),p=ctx().player,physician=physicianAt(),near=!!physician&&!ctx().remote&&foot()&&distance(p,physician)<=physician.radius&&queries.hasLineOfSight(body(p),body(physician));
    const canUseAfterClose=active()&&!ctx().remote&&!ctx().prone&&!sim.pending[link.playerId]&&!skills.busy()&&!ctx().sprinting&&!busy;
    return {canUse:canUseAfterClose&&!ctx().menu&&!ctx().skillMenu,canUseAfterClose,npc:physician,near,taught:c.taught,kitPending:c.kitPending,sampleCount:packCount(root,'scavenger-blood'),coins:packCount(root,'spirit-fragment'),
      recipes:Object.keys(MEDICINES).map(id=>recipePreview(root,id)),orders:c.orders.map(o=>({...o,name:MEDICINES[o.recipe].name,remaining:Math.max(0,(o.dueAt-Date.now())/1000)})),
      medicines:root.inventory.items.filter(i=>i.containerId===PACK&&MEDICINES[i.definitionId]).map(i=>({id:i.itemInstanceId,name:CAMP_ITEMS[i.definitionId].name,definitionId:i.definitionId,quantity:i.quantity,quality:i.quality,tier:i.tier,status:i.status,effect:MEDICINES[i.definitionId].effect,useSeconds:MEDICINES[i.definitionId].useSeconds})),
      shop:Object.entries(CAMP_SHOP).map(([id,d])=>({id,name:CAMP_ITEMS[id]?.name||'月露苔',price:d.buy,stock:c.shop[id]})),
      buyback:Object.entries(CAMP_BUYBACK).map(([id,price])=>({id,name:ITEMS[id]?.name||id,price,owned:packCount(root,id)})),buybackBudget:c.buybackBudget,
      cooldown:Math.max(0,c.cooldownUntil-sim.time),use:c.use?{...c.use,remaining:Math.max(0,c.use.dueAt-sim.time)}:null,staminaGrant:c.staminaGrant,busy,error};
  }
  function view() {
    const p=actor(link.playerId),usage=measureContainer(root.inventory,PACK),holder=measureHolder(root.inventory,link.playerId),near=nearest();
    const items=id=>root.inventory.items.filter(x=>x.containerId===id).map(x=>({id:x.itemInstanceId,name:ITEMS[x.definitionId]?.name||CAMP_ITEMS[x.definitionId]?.name||PROGRESSION_ITEMS[x.definitionId]?.name||SKILL_ITEM_NAMES[x.definitionId]||x.definitionId,quantity:x.quantity,medicine:!!MEDICINES[x.definitionId],locked:x.status!=='normal'}));
    const cooldown=Math.max(0,(sim.cooldowns[link.playerId]||0)-sim.time),c=ctx();
    const enemies=Object.entries(sim.enemies).map(([id,loc])=>{
      const def=sourceForMember(id),wing=def?.id===RIFTWING_ID,cast=sim.pending[id],move=wing&&riftwingAttack(cast?.kind);
      return {id:def?.id||id,instanceId:id,...loc,kind:wing?'riftwing':def?.kind||'monster',sparring:def?.id===ARENA_ID,
        ...(wing?{mode:sim.riftwings[id]?.mode||'ground',modeSince:sim.riftwings[id]?.modeSince||0,
          attack:move?{kind:move.kind===RIFTWING_ATTACKS.dive.kind?'dive':move.kind===RIFTWING_ATTACKS.sweep.kind?'sweep':'claw',start:cast.start,contact:cast.due,end:cast.end}:null}:{}),
        hp:Number(actor(id)?.hp||0),maxHp:Number(actor(id)?.maxHp||0),alive:alive(id),behavior:paths.get(id)?.behavior||'watch',
        phase:!alive(id)?'dead':(sim.hurt[id]||0)>sim.time?'hurt':cast?(sim.time<cast.due?'windup':'attack'):
          sim.time-(paths.get(id)?.lastMoved??-Infinity)<.12?(['patrol','return'].includes(paths.get(id)?.behavior)?paths.get(id).behavior:'chase'):'idle'};
    });
    const resources=world.resources.flatMap(def=>{const inst=root.director.anchors[def.id]?.current;if(!inst)return [];const con=root.inventory.containers.find(x=>x.sourceInstanceId===inst.instanceId);return [{id:def.id,remaining:con?count(root,con.containerId):0}];});
    const drops=root.drops.filter(d=>d.created&&sim.enemies[d.memberId]&&
      (sourceForMember(d.memberId)?.id!==RIFTWING_ID||sim.enemies[d.memberId].y<=queries.terrainHeight(sim.enemies[d.memberId].x,sim.enemies[d.memberId].z)+.1))
      .map(d=>({id:d.memberId,...sim.enemies[d.memberId],remaining:count(root,d.container.containerId)}));
    return {visible:!!c.playing||!!c.menu,screen:!alive(link.playerId)?'rescue':c.menu?'inventory':c.playing?'playing':'hidden',vehicle:{mounted:c.mounted},
      player:{...c.player,realm:p.realm,level:p.level,hp:Number(p.hp),maxHp:Number(p.maxHp),resource:Number(p.resource),maxResource:Number(baseResource(p.realm,p.level))},
      skill:{label:flightCombat()?airAttackForRealm(Number(p.realm)).name:'玄壳近距脉冲',ready:combatActive()&&!busy&&!cooldown,cooldown,reason:c.mounted?'驾驶时不可攻击':c.airborne&&!flightCombat()?'当前无法空中攻击':''},
      inventory:{items:items(PACK),slots:{used:Number(usage.slots),max:24,unit:'格'},volume:{used:Number(usage.volumeMl)/1000,max:40,unit:'L'},weight:{used:Number(holder.massGrams)/1000,max:36,unit:'kg'}},
      storage:{label:'营地仓库',enabled:atCamp(c.player)&&foot(),available:atCamp(c.player)&&foot(),items:items(CAMP)},
      nearby:near?{id:near.id,label:near.name,detail:near.remaining?`剩余 ${near.remaining} 份 · H 每次取 1 份`:'已采尽',action:near.action,enabled:near.remaining>0&&active()}:null,
      rescue:{required:!alive(link.playerId),enabled:!busy,detail:'返回营地安全点，保留背包、仓库与现场遗留物'},pending:busy,error,save:{status:saved,message:saved==='saved'?'外勤记录已保存':''},
      medicine:{active:!!root.camp?.use,cooldown:Math.max(0,(root.camp?.cooldownUntil||0)-sim.time),canUse:active()&&!ctx().remote&&!ctx().prone&&!sim.pending[link.playerId]&&!skills.busy()&&!ctx().sprinting&&!busy},enemies,resources,drops,time:sim.time,playerCast:sim.pending[link.playerId]||null,logs:sim.logs,load:holder};
  }
  // Finish a previously committed rescue whose following legacy localStorage write failed.
  const rescued=root.receipts.filter(r=>{try{return JSON.parse(r.signature).kind==='rescue';}catch{return false;}}).at(-1);
  if(rescued&&rescued.revision>(link.rescueRevision||0)){link.rescueRevision=rescued.revision;onRescue(clone(sceneConfig.safePoint),rescued.revision);}
  const castView=(id,pending)=>{const dx=pending.aim.x-pending.origin.x,dy=pending.aim.y-pending.origin.y,dz=pending.aim.z-pending.origin.z,length=Math.hypot(dx,dy,dz)||1;
    return {id:pending.castId,castId:pending.castId,sourceId:id,kind:pending.kind,realm:Number(actor(id)?.realm||0),origin:{...pending.origin},aim:{...pending.aim},direction:{x:dx/length,y:dy/length,z:dz/length},start:pending.start,release:pending.due,due:pending.due,end:pending.end,resolved:pending.resolved};};
  const meleePose=(pending,guarding=false,stunUntil=0)=>{const move=meleeMoveForKind(pending?.kind),cast=move?pending:null;return {move,phase:stunUntil>sim.time?'stun':guarding?'guard':cast?sim.time<cast.due?'windup':sim.time<cast.end?'recovery':'idle':'idle',
    start:cast?.start??0,contact:cast?.due??0,end:cast?.end??0,progress:cast?Math.max(0,Math.min(1,(sim.time-cast.start)/Math.max(.01,cast.end-cast.start))):0,guarding,stunUntil};};
  const meleeReaction=id=>{const e=sim.aerialMelee.events.findLast(e=>e.targetId===id&&e.start<=sim.time&&e.end>sim.time&&['impact','launch','parry','guardbreak'].includes(e.kind));return e?{kind:e.kind==='launch'?'launch':'impact',start:e.start,end:e.end}:null;};
  const aerialMeleeView=()=>({...meleePose(sim.pending[link.playerId],sim.aerialMelee.guarding,sim.aerialMelee.stunUntil),combo:sim.aerialMelee.combo,guardBroken:sim.aerialMelee.guardBreakUntil>sim.time,counterUntil:sim.aerialMelee.counterUntil,reaction:meleeReaction(link.playerId),
    events:sim.aerialMelee.events.filter(e=>e.end+1>=sim.time).map(e=>({...e,position:{...e.position},direction:{...e.direction}})),
    opponents:Object.entries(sim.enemies).filter(([id])=>sourceForMember(id)?.id===ARENA_ID).map(([id,loc])=>({id,x:loc.x,y:loc.y??queries.terrainHeight(loc.x,loc.z),z:loc.z,yaw:loc.yaw,alive:alive(id),hp:Number(actor(id)?.hp||0),maxHp:Number(actor(id)?.maxHp||0),...meleePose(sim.pending[id],!!sim.aerialMelee.opponents[id]?.guarding,sim.aerialMelee.opponents[id]?.stunUntil||0),reaction:meleeReaction(id)}))});
  return {tick,action,view,campView,skillsView:()=>({...skills.view(),error}),skillsMotion:skills.motion,cancelSkill:skills.cancel,progressionView:progression.view,explorationState:()=>clone(root.exploration),explorationAction:exploration=>issue('exploration',{exploration}),get medicineActive(){return !!campState(root).use;},get realm(){return actor(link.playerId)?.realm||0;},combatView:()=>({skills:skills.combatView(),player:{...ctx().player,realm:actor(link.playerId)?.realm||0,level:actor(link.playerId)?.level||1},playerCast:sim.pending[link.playerId]||null,ascensionCast:sim.pending[link.playerId]?.kind&&!meleeMoveForKind(sim.pending[link.playerId].kind)&&!isRiftwingKind(sim.pending[link.playerId].kind)?castView(link.playerId,sim.pending[link.playerId]):null,aerialCasts:Object.entries(sim.pending).filter(([,pending])=>pending.kind&&!meleeMoveForKind(pending.kind)&&!isRiftwingKind(pending.kind)).map(([id,pending])=>castView(id,pending)),aerialMelee:aerialMeleeView(),medicineUse:campState(root).use,time:sim.time,screen:ctx().playing&&!ctx().menu&&!ctx().skillMenu?'playing':'hidden'}),get busy(){return busy;},get blocking(){return busy&&inFlight?.kind!=='checkpoint';},get checkpointWorker(){return !!checkpointClient;},get defeated(){return !alive(link.playerId);},
    async checkpoint(){while(busy&&!closed)await new Promise(resolve=>idleWaiters.push(resolve));return issue('checkpoint',{scene:scene()});},snapshot:()=>clone(root),destroy(){closed=true;meleeBuffer=null;for(const resolve of idleWaiters.splice(0))resolve();checkpointClient?.close();storage.close();}};
}
