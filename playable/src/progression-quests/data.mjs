import {CAMP_V2_PEOPLE} from '../camp-v2/layout.mjs';
const station=id=>({...CAMP_V2_PEOPLE[id].home,radius:CAMP_V2_PEOPLE[id].radius});
export const NPCS=Object.freeze([
 {id:'N01',name:'林澈',role:'远征领队',...station('N01'),text:'先在营地外采回月露苔，并记录一次真实的掠兽交战。血样交给苏禾调查，再回来汇报。'},
 {id:'N03',name:'韩铸',role:'机械锻造师',...station('N03'),text:'铁陨要亲自回收。给我两份，我会开启精炼台；精炼材料仍由你保管。'},
 {id:'N04',name:'许衡',role:'商站管事',...station('N04'),text:'材料可以收购，额度与库存都在账上。仓库存放不收费，唯一调查证据不收。'},
 {id:'N05',name:'闻止',role:'导引教习',...station('N05'),text:'先让苏禾完成一次血样调查，再接受免费导引课。修为来自实地验证与持续修炼。'},
]);
export const QUESTS=Object.freeze({
 Q01:{npc:'N01',name:'营地首次远征',description:'实地采集月露苔至少两份，亲自击败一只掠兽，并完成苏禾血样调查。证据核验不再次消耗血样。',xp:100,coins:8},
 Q02:{npc:'N03',name:'回收铁陨',description:'实地采集过铁陨，交付背包中两份铁陨材，开放精炼服务。',xp:80,coins:4},
 Q03:{npc:'N04',name:'商站基础补给',description:'完成首次远征后，交付三份月露苔，换取十二碎灵石。',requires:'Q01',xp:40,coins:12},
 Q04:{npc:'N05',name:'识血导引',description:'完成医师血样调查，再接受免费导引课。开放在线打坐和72小时离线保底。',xp:20,coins:0},
 Q05:{npc:'N01',name:'荒野回报',description:'完成首次远征，前往风蚀石地实地调查，并返回营地归档。',requires:'Q01',xp:120,coins:8},
});
export const TRIAL_NODES=Object.freeze([
 {id:'breath-1',name:'引息节点·入',x:-38,z:154,radius:2.8,tuning:2},
 {id:'breath-2',name:'引息节点·循',x:32,z:132,radius:2.8,tuning:3},
 {id:'breath-3',name:'引息节点·归',x:44,z:192,radius:2.8,tuning:1},
]);
export const PROGRESSION_ITEMS={
 'refined-meteor-iron':{name:'精炼铁陨',unitMassGrams:'1000',unitVolumeMl:'200'},
 'spirit-stone':{name:'下品灵石',unitMassGrams:'100',unitVolumeMl:'100'},
 'spirit-fragment':{name:'碎灵石',unitMassGrams:'1',unitVolumeMl:'1'},
};
export const xpRequired=(realm,level)=>Math.round(100*4**realm*level**1.35);
export const REALMS=['后天','先天','灵海','金丹','元婴','化神','炼虚','合道','星劫','道源'];
export const MESSAGES={questUnavailable:'尚未满足接取条件。',questEvidence:'实际行动记录或交付材料不足。',questClaimed:'这项任务已结算，不会重复发奖。',progressionMaterials:'背包材料不足，未扣除物品。',progressionCapacity:'背包容量不足；请先存入仓库再重试。',progressionLocked:'先完成对应教学。',progressionTraining:'请先结束当前修炼。',progressionClock:'时间记录无效。',progressionTrial:'导引读数未匹配，或尚未持续稳定八秒。',progressionBreakthrough:'须后天十级满修为、完成三处引息归环及教习校准。'};
