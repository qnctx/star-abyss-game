import {openIndexedDB} from '../d3-session/indexeddb.mjs';
import {computeAttributes} from '../d3-combat/index.mjs';
import {emptyCamp} from '../foundation/camp-state.mjs';
import {emptyProgression} from './index.mjs';
import {xpRequired} from './data.mjs';
export const QUEST_LAB={db:'star-abyss-quest-lab-v1',key:'star-abyss-quest-lab-v1'};
export function questLabLink(uuid=()=>crypto.randomUUID()){return {version:1,worldId:'quest-lab:'+uuid(),playerId:'quest-lab:'+uuid(),rescueRevision:0};}
export function seedQuestLabRoot(root,playerId,scenario='opening'){
 if(!root.worldId.startsWith('quest-lab:')||!playerId.startsWith('quest-lab:'))throw Error('拒绝在正式档使用任务测试夹具');
 if(!['opening','breakthrough'].includes(scenario))throw Error('未知任务测试场景');
 const next=structuredClone(root),actor=next.combat.actors.find(a=>a.id===playerId);if(!actor)throw Error('测试角色缺失');
 const level=scenario==='breakthrough'?10:1,stats=computeAttributes({realm:0,level});
 Object.assign(actor,stats.effective,{realm:0,level,hp:stats.effective.maxHp,resource:stats.baseResource});
 next.camp={...emptyCamp(),progression:emptyProgression()};if(scenario==='breakthrough')next.camp.progression.xp=xpRequired(0,10);
 // Neither scenario grants task completion, collected items, trial nodes or blood-study evidence.
 return next;
}
export async function openQuestLabStorage(options,scenario='opening',open=openIndexedDB){
 const storage=await open({...options,name:QUEST_LAB.db+':'+scenario});const check=id=>{if(!id?.startsWith('quest-lab:'))throw Error('拒绝访问非任务测试档');};
 return {...storage,load(id){check(id);return storage.load(id);},initialize(root){check(root.worldId);return storage.initialize(seedQuestLabRoot(root,options.sceneConfig.playerId,scenario));},compareAndSwap(args){check(args.worldId);return storage.compareAndSwap(args);}};
}
