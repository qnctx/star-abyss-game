export const EQUIPMENT_TIMING=Object.freeze({drawing:.55,using:1.25,folding:.3,stowing:.5});
export const createEquipment=()=>({item:null,phase:'hidden',time:0,serial:0,emitted:false});
export function useScanner(state){
 if(state.phase!=='hidden')return false;
  Object.assign(state,{item:'scanner',phase:'drawing',time:0,serial:state.serial+1,emitted:false,stowStart:1});return true;
}
export function stowEquipment(state){if(state.phase!=='hidden'&&state.phase!=='stowing'){state.stowStart=equipmentView(state).exposure;state.phase='stowing';state.time=0;}}
export function updateEquipment(state,dt){
 let remaining=Math.max(0,Number.isFinite(dt)?dt:0),emit=false;
 while(remaining>0&&state.phase!=='hidden'){
  const duration=EQUIPMENT_TIMING[state.phase],step=Math.min(remaining,duration-state.time);state.time+=step;remaining-=step;
  if(state.time<duration-1e-8)break;
  state.time=0;
  if(state.phase==='drawing'){state.phase='using';if(!state.emitted){state.emitted=true;emit=true;}}
  else if(state.phase==='using')state.phase='folding';
  else if(state.phase==='folding')state.phase='stowing';
  else {state.phase='hidden';state.item=null;}
 }
 return {emit};
}
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function equipmentView(state){
 const phase=state?.phase||'hidden',t=state?.time||0,p=t/(EQUIPMENT_TIMING[phase]||1);
  const exposure=phase==='hidden'?0:phase==='drawing'?ease(p):phase==='stowing'?(state.stowStart??1)*(1-ease(p)):1;
 const fins=phase==='using'?1:phase==='drawing'?ease((p-.5)*2):phase==='folding'?1-ease(p):0;
 const tap=phase==='using'?1-ease((p-.35)/.5):phase==='drawing'?ease((p-.65)/.35):0;
 return {item:state?.item||null,phase,time:t,serial:state?.serial||0,visible:phase!=='hidden',exposure,fins,tap};
}
