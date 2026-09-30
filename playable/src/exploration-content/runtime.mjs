import {createDestinations} from './catalog.mjs';
import {destinationRecords} from './state.mjs';
import {createExplorationVisual} from './visual.mjs';
import {globalToLocal,localToGlobal,unit,dot,add,scale} from '../planet/coordinates.mjs';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
/** Physical authorization is called again by D3 after it reloads the root. */
export function createExplorationContent({THREE,scene,planet,legacyHeight,getContext,getRuntime,toast=()=>{}}){
 const {field,frame,terrain}=planet,destinations=createDestinations(field,{legacyHeight,frame});
 const toLocal=p=>globalToLocal(p,frame),upLocal=p=>{const u=unit(p);return {x:dot(u,frame.east),y:dot(u,frame.up),z:dot(u,frame.south)};};
 const visual=createExplorationVisual({THREE,scene,toLocal,upLocal});
 let timer=0,pending=false,records=[],near=null;
 function support(d){
  if(d.legacy)return {ready:true,position:d.position,waterDepth:0};
  const s=terrain.sampleRenderedSurface(d.position);
  return s?.ready&&s.spacing<=30&&s.waterDepth<=.1?{...s,ready:true}:{ready:false};
 }
 const playerPosition=()=>localToGlobal(getContext().player,frame);
 function sight(a,b){
  const from=add(a,scale(unit(a),1.65)),to=add(b,scale(unit(b),.25));
  return planet.adapter.sweep(from,to,.05).clear===true;
 }
 function available(){const c=getContext();return c.playing&&!c.menu&&!c.mounted&&!c.airborne&&!planet.active&&!getRuntime()?.defeated;}
 function access(_root,request){
  if(!available())return false;
  const p=playerPosition(),s=planet.adapter.sample(p);
  // Physical ground support; no remote collection from flight/parked legacy pose.
  if(!s.ready||Math.abs(s.agl)>.35||s.waterDepth>.1)return false;
  if(request.exploration?.action==='return')return planet.legacyActive()&&Math.hypot(getContext().player.x,getContext().player.z-190)<24;
  const d=destinations.find(d=>d.id===request.exploration?.id);if(!d)return false;
  const ground=support(d);if(!ground.ready)return false;
  return distance(p,ground.position)<(request.exploration.action==='discover'?65:3.2)&&sight(p,ground.position);
 }
 async function issue(action,id){
  if(pending)return false;const runtime=getRuntime();if(!runtime||runtime.busy)return false;
  pending=true;
  try{return await runtime.explorationAction({action,...(id?{id}:{})});}finally{pending=false;}
 }
 function refresh(){records=destinationRecords({exploration:getRuntime()?.explorationState?.()},destinations);}
 function tick(dt){
  timer+=dt;if(timer<.25)return;timer=0;refresh();near=null;
  const c=getContext(),p=playerPosition();
  if(available()){
   const target=records.filter(d=>distance(p,d.position)<70).sort((a,b)=>distance(p,a.position)-distance(p,b.position))[0];
   if(target&&access(null,{exploration:{action:'discover',id:target.id}})){
    if(!target.discovered&&!pending&&!getRuntime()?.busy)void issue('discover',target.id).then(ok=>{if(ok)toast('发现 '+target.name+' · 靠近地面标本后按 H 调查');});
    if(distance(p,support(target).position)<3.2)near=target;
   }
   const state=getRuntime()?.explorationState?.();
   if(state&&Object.keys(state.sites).some(id=>state.sites[id].investigatedAt!==null&&!state.returned.includes(id))&&access(null,{exploration:{action:'return'}})&&!pending&&!getRuntime()?.busy)
    void issue('return').then(ok=>{if(ok)toast('考察记录已归档。I 打开背包，可把实际物资存入营地仓库。');});
  }
  visual.update(records,support,c.playing||c.menu?p:null);
 }
 function interact(){
  refresh();if(!near||!available())return false;
  const d=records.find(d=>d.id===near.id);if(!d.discovered||pending)return true;
  if(d.investigated&&(d.kind==='legacy'||!d.quantity))return false;
  if(d.investigated&&!d.remaining){toast('本处标本已采尽。回营地存放物资，或继续探索。');return true;}
  const action=d.investigated?'collect':'investigate';
  if(!access(null,{exploration:{action,id:d.id}}))return false;
  void issue(action,d.id).then(ok=>{if(ok)toast(action==='investigate'?d.text:'已采入随身背包 1 份；剩余 '+Math.max(0,d.remaining-1)+' 份。');});return true;
 }
 function decorateView(view){
  const c=getContext();if(!c.playing&&!c.menu)return view;
  const remote=!planet.legacyActive();
   const result={...view,...(remote?{visible:true,screen:c.menu?'inventory':'playing',player:{...view.player,...c.player},storage:{...view.storage,enabled:false,available:false},medicine:{...view.medicine,canUse:false},skill:{...view.skill,ready:false,reason:'返回盆地后可使用战斗技能'},nearby:null}: {})};
  const d=near&&records.find(r=>r.id===near.id);
  if(d&&(!d.investigated||d.quantity))result.nearby={id:d.id,label:d.name,detail:!d.investigated?'H 调查地貌与标本':d.remaining?`H 采集 1 份 · 余 ${d.remaining} 份`:'本处标本已采尽 · 可回营地存放',enabled:available()&&(!d.investigated||d.remaining>0),action:'exploration'};
  return result;
 }
  return {tick,interact,access,decorateView,destinations,setVisible(visible){visual.root.visible=!!visible;},
  journal(){refresh();return records.filter(d=>d.investigated).map(d=>({title:'地貌考察 · '+d.name,text:d.text+'\n'+(d.quantity?'现场标本剩余 '+d.remaining+' 份；已采物资在真实背包或仓库中。':'本点记录不发放额外物资。')+'\n'+(d.returned?'已在营地归档。':'可继续探索，或回营地归档。')}));},
  mapMarkers(){refresh();return records.filter(d=>d.discovered).map(d=>{const s=support(d);return {...d,position:s.ready?s.position:d.position,supportReady:s.ready};});},
  // Authoritative authored coordinates for map previews; caller must retain discovery fog.
  snapshot(){refresh();return {records,pending,near:near?.id||null};},dispose(){visual.dispose();}};
}
