import {NPCS,TRIAL_NODES} from './data.mjs';
import {progressionState,progressionView} from './index.mjs';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
/** Host supplies the same live pose, LOS and CAS publisher used by D3 combat. */
export function createProgressionRuntime({getRoot,getContext,playerId,issue,lineOfSight}){
 let lastPulse=0,stationary=null;
 const grounded=c=>!c.mounted&&!c.airborne&&!c.dashing;
 const npcAt=(c,id)=>c.npcPositions?.[id]||NPCS.find(n=>n.id===id);
 const near=(c,target)=>{if(c.remote||!target||!grounded(c)||distance(c.player,target)>target.radius)return false;const d=Math.max(.001,distance(c.player,target)),inset=Math.min(1.1,d);return lineOfSight(c.player,{...target,x:target.x+(c.player.x-target.x)*inset/d,z:target.z+(c.player.z-target.z)*inset/d});};
 const facing=(p,target)=>distance(p,target)<.25||Math.abs(Math.atan2(Math.sin(Math.atan2(p.x-target.x,p.z-target.z)-p.yaw),Math.cos(Math.atan2(p.x-target.x,p.z-target.z)-p.yaw)))<=1.2;
 function authorize(root,request){const c=getContext(),a=request.progression,p=progressionState(root);if(!a||!c.playing&&!c.menu&&!(c.restoring&&a.action==='train-stop'&&p.training?.mode==='offline'))return false;
   if(c.remote)return false;
   if(!Number(root.combat.actors.find(x=>x.id===playerId)?.hp))return false;
   if(a.action==='trial-cancel'||a.action==='train-stop')return true;
   if(c.progressionReady&&a.npc&&!c.progressionReady.npcs.includes(a.npc))return false;
   if(c.progressionReady&&a.node&&!c.progressionReady.nodes.includes(a.node))return false;
   if(a.action==='train-settle')return near(c,npcAt(c,'N05'));
   if(request.scene?.pending?.[playerId]||root.camp?.use)return false;
   if(a.action.startsWith('trial-')){const node=TRIAL_NODES.find(n=>n.id===a.node);return !c.menu&&near(c,node)&&facing(c.player,node)&&(!a.action.endsWith('finish')||stationary?.id===node.id&&distance(c.player,stationary)<.25);}
   const npc=npcAt(c,a.npc);return near(c,npc)&&facing(c.player,npc);
 }
 function tick(time){const root=getRoot(),p=progressionState(root),c=getContext();
   if(p.trial.active){const node=TRIAL_NODES.find(n=>n.id===p.trial.active.id);
     if(!stationary||!near(c,node)||!facing(c.player,node)||distance(c.player,stationary)>.25||c.menu){stationary=null;return issue('progression',{progression:{action:'trial-cancel'}});}
     if(time-p.trial.active.start>=8)return issue('progression',{progression:{action:'trial-finish',node:node.id}});
   }
   if(p.training&&time-lastPulse>=2){lastPulse=time;const stop=!near(c,npcAt(c,'N05'));return issue('progression',{progression:{action:stop?'train-stop':'train-settle',wallTime:Date.now()}});}
 }
 async function action(a){if(a.action==='trial-start')stationary={...getContext().player,id:a.node};return issue('progression',{progression:{...a,wallTime:Date.now()}});}
 function view(){const c=getContext(),root=getRoot(),npcs=NPCS.map(n=>({...n,...npcAt(c,n.id)}));return {...progressionView(root,playerId),nearNpc:npcs.find(n=>near(c,n)&&facing(c.player,n))?.id||null,nearNode:TRIAL_NODES.find(n=>near(c,n)&&facing(c.player,n))?.id||null,npcs,nodes:TRIAL_NODES};}
 return {authorize,tick,action,view};
}
