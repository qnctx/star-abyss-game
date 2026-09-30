import fs from 'node:fs';
import * as THREE from 'three';
import {createPlanetField} from '../playable/src/planet/field.mjs';
import {createPlanetTerrain} from '../playable/src/planet/scene-adapter.mjs';
import {terrainHeight} from '../playable/src/layout.mjs';
const field=createPlanetField({legacyHeight:terrainHeight,legacyMaxHeight:310});
const terrain=createPlanetTerrain({THREE,scene:new THREE.Scene(),field,legacyMaskHalfSize:3000});
const samples=[];let start=performance.now();terrain.update(field.surfacePoint(field.routeDirection(8000)));const startup=performance.now()-start;
for(let i=1;i<=80;i++){const p=field.surfacePoint(field.routeDirection(8000+i*40));start=performance.now();terrain.update(p,{budgetMs:3,maxLoads:1});samples.push(performance.now()-start);while(terrain.pending){start=performance.now();terrain.update(p,{budgetMs:3,maxLoads:1});samples.push(performance.now()-start);}}
samples.sort((a,b)=>a-b);const result={label:process.argv[2],startupMs:startup,samples:samples.length,p50:samples[Math.floor(samples.length*.5)],p95:samples[Math.floor(samples.length*.95)],max:samples.at(-1),sum:samples.reduce((a,b)=>a+b,0),active:terrain.root.children.length};
terrain.destroy();fs.mkdirSync('reports/performance-r1',{recursive:true});fs.writeFileSync(`reports/performance-r1/${process.argv[2]}-terrain.json`,JSON.stringify(result,null,2));console.log(result);
