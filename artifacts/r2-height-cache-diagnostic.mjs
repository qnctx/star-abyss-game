import {legacyTerrainHeight} from '../playable/src/layout.mjs';
for (const x of [2500, 3000, 3100, 3500, 3900]) {
  const times=[];
  for (let i=0;i<20;i++) {
    const start=performance.now();
    legacyTerrainHeight(x, 172.4);
    times.push(performance.now()-start);
  }
  console.log(JSON.stringify({x,firstMs:times[0],meanRepeatMs:times.slice(1).reduce((a,b)=>a+b,0)/19,maxRepeatMs:Math.max(...times.slice(1))}));
}
