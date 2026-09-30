// D3-19/20/22, 2026-09-12. Tier is learned independently of actor realm.
export const SKILL_VERSION='d3-first-six-v001';
const rows=[
 ['WS01','断浪斩',0,1,6,1.3,0,3,'H1',.35,.4,5,6,'physical','water','saber','water-crescent'],
 ['WS03','点星刺',0,1,4,1.15,0,3,'H1',.2,.3,4,5,'physical','metal','sword','star-tip'],
 ['ES05','激流矢',1,1,6,0,1.25,20,'H2',.4,.3,7,7,'spiritual','water',null,'water-spindle'],
 ['ES13','引雷针',2,2,8,.1,1.35,20,'H3',.8,.4,9,10,'spiritual','thunder',null,'thunder-needle'],
 ['HS04','定向屏障',0,2,0,0,0,0,'H6',.4,.4,15,15,'spiritual','earth',null,'honeycomb-fan'],
 ['HS06','金蝉脱印',2,3,0,0,0,0,'H6',.25,.3,24,16,'spiritual','light',null,'gold-shell'],
];
export const SKILLS=Object.freeze(Object.fromEntries(rows.map(([id,name,minimumRealm,difficulty,C,a,b,range,hit,windup,recovery,cooldown,cost,channel,element,weapon,shape])=>[id,Object.freeze({id,name,minimumRealm,difficulty,C,a,b,range,hit,windup,recovery,cooldown,costPercent:cost/100,channel,element,weapon,shape,slot:weapon?'weapon':'active',activeDuration:hit==='H1'?.12:0,maxTargets:['H1','H3'].includes(hit)?4:1,weights:[1]})])));
export const STAGES=['入门','小成','精通','大成','圆满'];
export const DIFFICULTY=[0,1,1.5,2.3];
export const THRESHOLDS=[0,100,350,800,1500];
export const DEMONSTRATIONS=[0,3,5,8];
export function skillDefinition(id,learned){const d=SKILLS[id];if(!d)throw Error('skillUnknown');return {...d,mastery:learned?.mastery||1,learnedTier:learned?.tier??d.minimumRealm};}
export const EFFECT_VARIANTS=Object.freeze(Object.fromEntries(Object.values(SKILLS).map(d=>[d.id,[1,2,3,4,5].map(k=>({stage:k,shape:d.shape,detail:k,damageRadius:d.range,extraHits:0}))])));
