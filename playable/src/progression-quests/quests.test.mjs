import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession} from '../d3-session/index.mjs';
import {initialRoot,rulesFor,PACK,ATTACK} from '../expedition-runtime/rules.mjs';
import {sceneConfigFor} from '../expedition-runtime/index.mjs';
import {createState} from '../d3-inventory/index.mjs';
import {emptyCamp} from '../foundation/camp-state.mjs';
import {evidence,progressionState,progressionView} from './index.mjs';
import {NPCS,xpRequired} from './data.mjs';
import {createProgressionRuntime} from './runtime.mjs';
import {seedQuestLabRoot} from './lab-storage.mjs';
const clone=structuredClone;
async function fixture(){
 const world={resources:[{id:'moss',siteId:'test',itemId:'moon-moss',count:8,x:60,z:100},{id:'iron',siteId:'test',itemId:'meteor-iron',count:8,x:70,z:100}],enemies:[{id:'beast',siteId:'test',x:100,z:100}]};
 const rules=rulesFor(world),query=()=>({ecologyAllowed:true,groundSupported:true,collisionFree:true,reachable:true,pathClear:true,outsideProtectedVolumes:true,budgetAllowed:true,corpseClear:true,playerDistance:100,visible:false,unsettledLootContainers:0,placementId:'test'});
 const link={worldId:'quest-test',playerId:'player'};let saved=initialRoot(link,rules,query),fail=false,sequence=0;
 const storage={load:async()=>clone(saved),compareAndSwap:async({expectedRevision,nextState})=>{if(fail||expectedRevision!==saved.revision)return false;saved=clone(nextState);return true;}};
 const session=createSession({storage,definitions:rules.definitions,materialize:rules.materialize,spatialQuery:query,authorize:()=>true,sceneConfig:sceneConfigFor('player')});
 const execute=async(kind,fields={},time=saved.simTime)=>session.execute({worldId:saved.worldId,transactionId:'t'+(++sequence),expectedRevision:saved.revision,simTime:time,kind,...fields});
 const op=(action,fields={},time)=>execute('progression',{progression:{action,...fields}},time);
 async function gather(anchor,n){if(!saved.director.anchors[anchor]?.current)await execute('spawn',{anchorId:anchor});for(let i=0;i<n;i++){const instance=saved.director.anchors[anchor].current,con=saved.inventory.containers.find(c=>c.sourceInstanceId===instance.instanceId),item=saved.inventory.items.find(i=>i.containerId===con.containerId);await execute('transfer',{operations:[{kind:'transfer',itemInstanceId:item.itemInstanceId,fromContainerId:con.containerId,toContainerId:PACK,quantity:1}]});}}
 async function kill(){await execute('spawn',{anchorId:'beast'});const target=saved.director.anchors.beast.current.members[0].instanceId;for(let i=0;saved.combat.actors.find(a=>a.id===target).hp!=='0';i++){await execute('cast',{cast:{worldId:saved.worldId,sourceId:'player',castId:'c'+i,skill:ATTACK}});await execute('hit',{hit:{worldId:saved.worldId,castId:'c'+i,hitId:'h'+i,targetId:target,segment:0}});}const drop=saved.drops.find(d=>d.memberId===target),item=saved.inventory.items.find(i=>i.containerId===drop.container.containerId);await execute('transfer',{operations:[{kind:'transfer',itemInstanceId:item.itemInstanceId,fromContainerId:item.containerId,toContainerId:PACK,quantity:1}]});}
 return {op,execute,gather,kill,session,get root(){return clone(saved);},setRoot:r=>{saved=clone(r);},fail:v=>fail=v};
}
test('真实采集、玩家击杀、血样调查构成首次远征；重复交付不发奖',async()=>{
 const f=await fixture();await f.op('accept',{npc:'N01',quest:'Q01'});await assert.rejects(f.op('deliver',{npc:'N01',quest:'Q01'}),/questEvidence/);
 await f.gather('moss',2);await f.kill();await f.execute('camp',{camp:{action:'teach'}});
 assert.equal(evidence(f.root,'player').kills,1);assert.equal(evidence(f.root,'player').gathered['moon-moss'],2);
 await f.op('deliver',{npc:'N01',quest:'Q01'});assert.equal(f.root.combat.actors[0].level,2);const saved=f.root;
 await assert.rejects(f.op('deliver',{npc:'N01',quest:'Q01'}),/questClaimed/);assert.deepEqual(f.root,saved);assert.deepEqual(await f.session.load('quest-test'),saved);
});
test('精炼使用真实铁陨；消耗后仍可追溯采集，写入失败可重试',async()=>{
 const f=await fixture();await f.gather('iron',4);await f.op('accept',{npc:'N03',quest:'Q02'});const before=f.root;
 f.fail(true);await assert.rejects(f.op('deliver',{npc:'N03',quest:'Q02'}),/commitRejected/);assert.deepEqual(f.root,before);f.fail(false);
 await f.op('deliver',{npc:'N03',quest:'Q02'});await f.op('refine',{npc:'N03'});assert.equal(progressionView(f.root,'player').refined,1);assert.equal(progressionView(f.root,'player').iron,0);assert.equal(evidence(f.root,'player').gathered['meteor-iron'],4);
});
test('背包满时奖励和扣料全量回滚',async()=>{
 const f=await fixture();await f.gather('iron',3);await f.op('accept',{npc:'N03',quest:'Q02'});let r=f.root;r.inventory.containers.find(c=>c.containerId===PACK).maxSlots=3;
 r.inventory.items=createState({worldId:r.worldId,holders:r.inventory.holders,containers:r.inventory.containers,items:[...r.inventory.items,...['full1','full2'].map(id=>({itemInstanceId:id,definitionId:id,containerId:PACK,quantity:1,maxStack:1,unitMassGrams:'0',unitVolumeMl:'0'}))]}).items;f.setRoot(r);const before=f.root;
 await assert.rejects(f.op('deliver',{npc:'N03',quest:'Q02'}),/progressionCapacity/);assert.deepEqual(f.root,before);
});
test('旧存档不追溯离线；72小时结算与时间回拨不能重复收益',async()=>{
 const f=await fixture();assert.equal(f.root.camp,undefined);await f.gather('moss',2);await f.kill();await f.execute('camp',{camp:{action:'teach'}});
 await f.op('accept',{npc:'N05',quest:'Q04'});await f.op('deliver',{npc:'N05',quest:'Q04'});await f.op('train-start',{npc:'N05',mode:'offline',wallTime:1000000});
 await f.op('train-settle',{wallTime:1000000+96*3600000});let p=progressionState(f.root);assert.equal(p.training,null);assert.equal(p.trainingReport.gained,720);const before=f.root.combat.actors[0].level;
 await f.op('train-settle',{wallTime:100});assert.equal(f.root.combat.actors[0].level,before);assert.equal(progressionState(f.root).xp,p.xp);
});
test('三节点真实计时、校准、满槽后突破同一角色；不跨境囤积',async()=>{
 const f=await fixture();let r=f.root;r.camp=emptyCamp();r.camp.taught=true;f.setRoot(r);await f.op('accept',{npc:'N05',quest:'Q04'});await f.op('deliver',{npc:'N05',quest:'Q04'});
 for(const [id,tuning] of [['breath-1',2],['breath-2',3],['breath-3',1]]){await f.op('trial-start',{node:id,tuning});await assert.rejects(f.op('trial-finish',{node:id}),/progressionTrial/);await f.op('trial-finish',{node:id},f.root.simTime+8);}
 await f.op('calibrate',{npc:'N05'});await assert.rejects(f.op('breakthrough',{npc:'N05'}),/progressionBreakthrough/);
 r=f.root;r.combat.actors[0].level=10;r.camp.progression.xp=xpRequired(0,10);f.setRoot(r);await f.op('breakthrough',{npc:'N05'});
 assert.equal(f.root.combat.actors[0].realm,1);assert.equal(f.root.combat.actors[0].level,1);assert.equal(progressionState(f.root).xp,0);assert.equal(progressionView(f.root,'player').capabilities.selfFlightMaxHeight,0);await assert.rejects(f.op('breakthrough',{npc:'N05'}),/progressionBreakthrough/);
});
test('同一事务重试返回旧receipt；并发不同事务只可成功一次',async()=>{
 const f=await fixture();await f.gather('iron',2);await f.op('accept',{npc:'N03',quest:'Q02'});
 const request={worldId:'quest-test',transactionId:'shared',expectedRevision:f.root.revision,simTime:0,kind:'progression',progression:{action:'deliver',npc:'N03',quest:'Q02'}};
 const first=await f.session.execute(request);assert.equal((await f.session.execute(request)).replayed,true);assert.deepEqual(f.root,first.state);
 await assert.rejects(f.session.execute({...request,transactionId:'racing'}),/revisionConflict/);
});
test('N04精炼材料出售、有限库存购买、1:100兑换可逆且不会额外发币',async()=>{
 const f=await fixture();await f.gather('iron',4);await f.op('accept',{npc:'N03',quest:'Q02'});await f.op('deliver',{npc:'N03',quest:'Q02'});await f.op('refine',{npc:'N03'});await f.op('sell-refined',{npc:'N04'});
 assert.equal(progressionView(f.root,'player').coins,14);assert.equal(f.root.camp.buybackBudget,90);await f.op('buy',{npc:'N04',item:'solvent'});assert.equal(progressionView(f.root,'player').coins,13);assert.equal(f.root.camp.shop.solvent,11);
 const before=f.root;await assert.rejects(f.op('exchange',{npc:'N04',direction:'up'}),/progressionMaterials/);assert.deepEqual(f.root,before);
 const r=f.root,item=r.inventory.items.find(i=>i.definitionId==='spirit-fragment');r.inventory.items=r.inventory.items.filter(i=>i.definitionId!=='spirit-fragment'||i===item);item.quantity=100;item.lots=[{...item.lots[0],quantity:100}];f.setRoot(r);
 await f.op('exchange',{npc:'N04',direction:'up'});assert.equal(progressionView(f.root,'player').stones,1);await f.op('exchange',{npc:'N04',direction:'down'});assert.equal(progressionView(f.root,'player').coins,100);
});
test('runtime重新检查距离/视线/朝向/落地，走开取消真实站定计时',async()=>{
 const f=await fixture();let root=f.root,ctx={player:{x:NPCS[0].x,z:NPCS[0].z+2,yaw:0},playing:true,menu:false,mounted:false,airborne:false,dashing:false},los=true;const issues=[];
 const runtime=createProgressionRuntime({getRoot:()=>root,getContext:()=>ctx,playerId:'player',issue:(kind,fields)=>{issues.push({kind,...fields});return true;},lineOfSight:()=>los});
 const req={progression:{action:'accept',npc:'N01',quest:'Q01'}};
 assert.equal(runtime.authorize(root,req),true);ctx.player.yaw=Math.PI;assert.equal(runtime.authorize(root,req),false);ctx.player.yaw=0;los=false;assert.equal(runtime.authorize(root,req),false);los=true;ctx.airborne=true;assert.equal(runtime.authorize(root,req),false);ctx.airborne=false;
 root.camp=emptyCamp();root.camp.progression={...progressionState(root),trial:{nodes:[],active:{id:'breath-1',start:0},calibrated:false}};runtime.tick(3);assert.equal(issues.at(-1).progression.action,'trial-cancel');
});
test('快速验收夹具拒绝正式档，不注入任务/物资/试炼完成证据',async()=>{
 const f=await fixture();assert.throws(()=>seedQuestLabRoot(f.root,'player','breakthrough'),/正式档/);
 const r=f.root;r.worldId='quest-lab:test';r.combat.actors[0].id='quest-lab:player';const quick=seedQuestLabRoot(r,'quest-lab:player','breakthrough');
 assert.equal(quick.combat.actors[0].level,10);assert.equal(quick.camp.progression.xp,xpRequired(0,10));assert.equal(quick.camp.taught,false);assert.deepEqual(quick.camp.progression.quests,{});assert.deepEqual(quick.camp.progression.trial.nodes,[]);assert.deepEqual(quick.inventory.items,[]);
});
test('远程菜单不能冒用营地停放坐标进行任何成长事务',async()=>{
 const f=await fixture(),root=f.root;const ctx={remote:true,playing:false,menu:true,restoring:true,player:{x:NPCS[0].x,z:NPCS[0].z+2,yaw:0},mounted:false,airborne:false};
 const runtime=createProgressionRuntime({getRoot:()=>root,getContext:()=>ctx,playerId:'player',issue:()=>true,lineOfSight:()=>true});
 for(const action of ['accept','deliver','buy','exchange','train-start','train-stop','train-settle','trial-start','trial-finish','trial-cancel','breakthrough'])assert.equal(runtime.authorize(root,{progression:{action,npc:'N01',quest:'Q01'}}),false,action);
 ctx.remote=false;assert.equal(runtime.authorize(root,{progression:{action:'accept',npc:'N01',quest:'Q01'}}),true);
});
