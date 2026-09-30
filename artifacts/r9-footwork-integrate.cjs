const fs=require('fs'),p='playable/src/main.mjs';let s=fs.readFileSync(p,'utf8');
s="import {aerialFootwork} from './aerial-footwork.mjs';\n"+s;
s=s.replace("  const load=expeditionRuntime?.view().load;\n  if(expeditionRuntime?.medicineActive)","  const expeditionView=expeditionRuntime?.view(),load=expeditionView?.load;\n  if(planetRuntime?.active)controls=aerialFootwork(controls,player,(expeditionView?.enemies||[]).map(e=>({...e,y:e.y??terrainHeight(e.x,e.z)})));\n  if(expeditionRuntime?.medicineActive)");
fs.writeFileSync(p,s);
