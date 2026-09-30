import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhase1Outcrops} from '../src/phase1-outcrops.mjs';
test('outcrops are deterministic, convex-footprint-contained, finite and off routes',()=>{
  const rocks=createPhase1Outcrops();assert.deepEqual(rocks,createPhase1Outcrops());assert.equal(rocks.length,7);
  for(const r of rocks){
    assert.ok(Math.abs(r.x)-r.radius>40);
    if(r.z+r.radius>=-810&&r.z-r.radius<=-450)assert.ok(Math.abs(r.x)-r.radius>65);
    assert.equal(r.vertices.length,8);assert.equal(r.meshColors.length,r.meshPositions.length);
    assert.equal(r.meshIndices.length,r.meshPositions.length/3);
    assert.ok(r.meshIndices.length/3>=500);
    for(let i=0;i<r.meshPositions.length;i+=3){
      const x=r.meshPositions[i],y=r.meshPositions[i+1],z=r.meshPositions[i+2];
      assert.ok(Number.isFinite(x+y+z));assert.ok(y>=-.251&&y<=r.height*1.03);
      for(let e=0;e<8;e++){
        const a=r.vertices[e],b=r.vertices[(e+1)%8];
        assert.ok((b.x-a.x)*(z-a.z)-(b.z-a.z)*(x-a.x)>=-1e-8,'mesh outside convex collision footprint');
      }
    }
  }
});
