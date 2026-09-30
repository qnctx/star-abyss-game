import {test} from 'node:test';
import assert from 'node:assert/strict';
import {terrainHeight,POINTS,TERRAIN_SEGMENTS,WORLD,collides} from '../src/layout.mjs';
import {PHASE1_LANDFORMS,phase1Relief} from '../src/phase1-terrain.mjs';
test('main walking corridor and ship remain level and accessible',()=>{
  for(let z=188;z>-467;z-=1){assert.equal(terrainHeight(0,z),0);assert.equal(collides(0,z),false);}
  for(const p of POINTS.filter(p=>p.z< -470&&Math.abs(p.x)<50))assert.equal(terrainHeight(p.x,p.z),0);
});
test('concept landmarks provide distinct physical relief without replacing world size',()=>{
  assert.equal(WORLD.halfSize,3000);
  for(const p of PHASE1_LANDFORMS)assert(terrainHeight(p.x,p.z)>10,p.name);
  assert(phase1Relief(145,-150)<-8,'impact bowl is concave');
  assert(phase1Relief(210,-150)>0,'impact rim rises around bowl');
});
test('collision height interpolates the exact rendered triangles across new relief',()=>{
  const step=6000/TERRAIN_SEGMENTS;
  for(let x=-280;x<310;x+=13.7)for(let z=-960;z<240;z+=29.3){
    const x0=Math.floor((x+3000)/step)*step-3000,z0=Math.floor((z+3000)/step)*step-3000;
    const u=(x-x0)/step,v=(z-z0)/step;
    const a=terrainHeight(x0,z0),b=terrainHeight(x0,z0+step),d=terrainHeight(x0+step,z0),c=terrainHeight(x0+step,z0+step);
    const expected=u+v<=1?a+(d-a)*u+(b-a)*v:c*(u+v-1)+b*(1-u)+d*(1-v);
    assert(Math.abs(terrainHeight(x,z)-expected)<1e-7);
  }
});
