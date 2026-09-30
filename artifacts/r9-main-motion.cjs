const fs=require('fs'),p='playable/src/main.mjs';let s=fs.readFileSync(p,'utf8');
s=s.replace("function canUseBlink(){",`function canUseBlink(){
  const cv=expeditionRuntime?.combatView(),melee=cv?.aerialMelee;
  if(melee&&(melee.guarding||melee.stunUntil>cv.time||melee.end>cv.time)){ui.toast('拳脚收势或受击期间暂不能虚步。');return false;}`);
s=s.replace("  const takeoff=routeInnateTakeoff(controls,",`  if(planetRuntime?.active){const combat=expeditionRuntime?.combatView(),melee=combat?.aerialMelee;if(melee&&(melee.guarding||melee.end>combat.time||melee.stunUntil>combat.time))controls={...controls,forward:false,backward:false,left:false,right:false,sprint:false,boost:false,lift:false,descend:false};}
  const takeoff=routeInnateTakeoff(controls,`);
s=s.replace('ascension:world.ascensionSnapshot(),','ascension:world.ascensionSnapshot(),combat:expeditionRuntime?.combatView(),airImpulse:planetRuntime?.airImpulseSnapshot(),');
fs.writeFileSync(p,s);
