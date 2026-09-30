import * as THREE from 'three';
import {createPlanetArtBatch} from '../../../playable/src/planet-art/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const out=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
for(const kind of ['tree','reed','pebble']) for(const lod of [0,1]){
 const b=createPlanetArtBatch(THREE,{kind,records:[],seed:190916,lod});
 const g=b.mesh.geometry;
 const data={reference:'docs/art/planet-v1/surface-transition-concept.png',kind,lod,positions:Array.from(g.attributes.position.array),normals:Array.from(g.attributes.normal.array),colors:Array.from(g.attributes.color.array)};
 // Preserve crown coverage when the original far model reduces leaf count.
 // Only folded leaf triangles (green color) are enlarged about their own centers.
 if(kind==='tree') for(let i=0;i<data.positions.length;i+=9){
  if(data.colors[i+1]<=data.colors[i]) continue;
  const center=[0,1,2].map(k=>(data.positions[i+k]+data.positions[i+3+k]+data.positions[i+6+k])/3);
  const factor=lod?3.6:1.65;
  for(let j=0;j<9;j++)data.positions[i+j]=center[j%3]+(data.positions[i+j]-center[j%3])*factor;
 }
 fs.writeFileSync(path.join(out,`${kind}-${lod}.json`),JSON.stringify(data));
 console.log(kind,lod,data.positions.length/9);b.dispose();
}
const files=['../../../docs/art/planet-v1/planet-ecology-concept.png','../../../docs/art/planet-v1/surface-transition-concept.png','../../../playable/src/planet-art/index.mjs','export.mjs',...['tree','reed','pebble'].flatMap(k=>[`${k}-0.json`,`${k}-1.json`])];
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({source:'Existing generated reference → existing authored geometry → native adaptation',newGenerations:0,files:Object.fromEntries(files.map(f=>[f,createHash('sha256').update(fs.readFileSync(path.resolve(out,f))).digest('hex')]))},null,2));
