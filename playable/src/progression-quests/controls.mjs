import {createQuestPanel,trialPrompt} from './ui.mjs';
/** Mount after world assets; host keeps the existing pause, save, pointer-lock and warehouse paths. */
export function createProgressionControls({getRuntime,isPlaying,isMenu,setMenu,openStorage,saveAndExit,npcReady,nodeReady,toast}){
 const panel=createQuestPanel({onAction:async action=>{
   const runtime=getRuntime();if(!runtime)return;
   const ok=await runtime.action({type:'progression',progression:action});
   refresh();if(ok&&action.action==='train-start'&&action.mode==='offline'){panel.close();await saveAndExit();}
 },onClose:()=>setMenu(false),onStorage:openStorage});
 function refresh(){const runtime=getRuntime();if(!runtime||!isPlaying()){if(panel.isOpen)panel.close();return;}panel.update({...runtime.progressionView(),error:runtime.view().error});}
 function key(e){const runtime=getRuntime();if(!runtime||!isPlaying()||isMenu()||runtime.busy)return;const view=runtime.progressionView();
   if(e.code==='KeyF'&&view.nearNpc&&npcReady(view.nearNpc)){e.preventDefault();e.stopImmediatePropagation();setMenu(true);refresh();panel.open(view.nearNpc);return;}
   const prompt=trialPrompt(view);if(prompt&&nodeReady(prompt.node)&&e.code==='KeyF'){e.preventDefault();e.stopImmediatePropagation();toast(prompt.text+' · 按1/2/3选择调谐档位');return;}
   if(prompt&&nodeReady(prompt.node)&&['Digit1','Digit2','Digit3'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();toast(prompt.text);void runtime.action({type:'progression',progression:{action:'trial-start',node:prompt.node,tuning:Number(e.code.slice(-1))}});}
 }
 window.addEventListener('keydown',key,true);
 return {refresh,panel,destroy(){window.removeEventListener('keydown',key,true);panel.destroy();}};
}
