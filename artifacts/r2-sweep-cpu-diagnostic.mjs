import {legacyTerrainHeight} from '../playable/src/layout.mjs';
import {createPlanetField} from '../playable/src/planet/field.mjs';
import {localToGlobal,tangentFrame} from '../playable/src/planet/coordinates.mjs';
import {createRuntimeWorld} from '../playable/src/planet-gameplay/runtime-world.mjs';

const frame=tangentFrame();
const field=createPlanetField({legacyHeight:legacyTerrainHeight,legacyMaxHeight:310,frame});
const world=createRuntimeWorld({field,loaded:()=>true,solidSweep:()=>({ready:true,clear:true}),sampleTerrain:(_p,raw)=>raw});
for(const x of [2500,3100,3500,3900,4100]){
  const from=localToGlobal({x,y:2000,z:172.4},frame),to=localToGlobal({x:x+7,y:2000,z:172.4},frame);
  const times=[];
  for(let i=0;i<5;i++){
    const start=performance.now(),result=world.sweep(from,to,.9);
    times.push(performance.now()-start);
    if(!result.ready||!result.clear)throw new Error(`unexpected blocked sweep at ${x}`);
  }
  console.log(JSON.stringify({x,firstMs:times[0],repeatMeanMs:times.slice(1).reduce((a,b)=>a+b,0)/4,repeatMaxMs:Math.max(...times.slice(1))}));
}
