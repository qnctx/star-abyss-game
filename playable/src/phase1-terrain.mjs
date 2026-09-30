// Authored from docs/art/environments/phase1-v1/map-concept.png.
// Metres; -Z is north. Landmarks are heightfield geometry, not scenery shells.
const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=(a,b,t)=>{const u=clamp((t-a)/(b-a));return u*u*(3-2*u);};
export const PHASE1_LANDFORMS=Object.freeze([
  {name:'营地西侧阶岩',x:-108,z:105,rx:65,rz:104,h:23},
  {name:'东侧玄武岩台地',x:156,z:10,rx:74,rz:110,h:31},
  {name:'峡谷西壁',x:-78,z:-100,rx:45,rz:86,h:24},
  {name:'中继东壁',x:81,z:-287,rx:44,rz:75,h:29},
  {name:'中继西壁',x:-86,z:-348,rx:55,rz:93,h:33},
  {name:'残骸西岭',x:-144,z:-600,rx:72,rz:206,h:38},
  {name:'残骸东岭',x:163,z:-658,rx:74,rz:170,h:27},
  {name:'北侧破碎坑缘',x:28,z:-915,rx:210,rz:80,h:36},
]);
export const PHASE1_CRATERS=Object.freeze([
  {x:145,z:-150,r:77,depth:13,rim:10},
  {x:-220,z:-270,r:56,depth:8,rim:7},
  {x:277,z:-467,r:110,depth:17,rim:13},
]);
export function phase1Relief(x,z){
  let h=0;
  for(const p of PHASE1_LANDFORMS){
    const ax=(x-p.x)/p.rx,az=(z-p.z)/p.rz;
    const edgeWarp=1+Math.sin(z*.063+x*.027)*.12+Math.sin(z*.139-x*.071)*.055;
    const r=Math.pow(Math.abs(ax)**3.3+Math.abs(az)**3.3,1/3.3)*edgeWarp;
    if(r>=1.45)continue;
    const profile=1-smooth(.68,1.10,r);
    // Broad sediment shelves with irregular fault lines, no repeated cones.
    const fault=Math.sin(x*.083+z*.037)*Math.sin(z*.061-x*.021);
    const terraced=profile*.52+Math.floor(profile*5)/5*.48;
    h+=p.h*terraced+fault*3.2*profile;
  }
  for(const p of PHASE1_CRATERS){
    const r=Math.hypot(x-p.x,(z-p.z)*1.08)/p.r;
    if(r>1.6)continue;
    h+=p.rim*Math.exp(-(((r-1)/.17)**2))-p.depth*(1-smooth(.15,.88,r));
  }
  // Preserve the central driving/walking corridor and the existing ship deck.
  // Broad fades avoid steep steps at the edge of the preserved legacy platform.
  const canyon=1-smooth(-80,-20,z);
  const route=1-(1-smooth(28-canyon*10,44-canyon*10,Math.abs(x)))*smooth(-880,-840,z)*(1-smooth(245,295,z));
  const ship=1-(1-smooth(64,105,Math.abs(x)))*smooth(-880,-820,z)*(1-smooth(-468,-428,z));
  const landing=smooth(35,78,Math.hypot(x,z-190));
  const recovery=smooth(36,67,Math.hypot(x-84,z-82));
  return h*route*ship*landing*recovery;
}

export function phase1Surface(x,z,height){
  const strata=.5+.5*Math.sin(height*1.45+x*.018+Math.sin(z*.023)*.7);
  const ejecta=PHASE1_CRATERS.reduce((v,p)=>Math.max(v,Math.exp(-(((Math.hypot(x-p.x,z-p.z)/p.r-1.18)/.30)**2))),0);
  return {strata,ejecta};
}
