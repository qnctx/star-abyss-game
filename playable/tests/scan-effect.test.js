const test=require('node:test');const assert=require('node:assert/strict');
test('scan keeps its emission position while the observer moves, expands once and freezes with simulation',async()=>{
 const {createScanState,updateScanState}=await import('../src/scan-effect.mjs');const s=createScanState();
 updateScanState(s,5,12,{x:1,y:2,z:3});updateScanState(s,4,13,{x:30,y:2,z:70});
 assert.deepEqual(s.origin,{x:1,y:2,z:3});const radius=s.radius;
 const frozen=structuredClone(s);updateScanState(s,4,13,{x:30,y:2,z:70});assert.deepEqual(s,frozen);
 updateScanState(s,2,15,{x:50,y:2,z:80});assert.ok(s.radius>radius);
 updateScanState(s,0,17,{});assert.equal(s.active,false);assert.equal(s.opacity,0);
 updateScanState(s,5,20,{x:9,y:2,z:9});assert.equal(s.origin.x,9);
 updateScanState(s,2,0,{});assert.equal(s.active,false);
});
test('200 scan cycles reuse geometry and material; resources dispose once',async()=>{
 const {createScanEffect}=await import('../src/scan-effect.mjs');const fx=createScanEffect();
 const meshes=fx.root.children;const ids=meshes.map(m=>[m.geometry.uuid,m.material.uuid]);let disposals=0;
 for(const m of meshes){m.geometry.addEventListener('dispose',()=>disposals++);m.material.addEventListener('dispose',()=>disposals++);assert.equal(m.material.depthTest,true);}
 for(let i=0;i<200;i++){fx.update(5,i*10,{x:i,y:1,z:0});fx.update(2,i*10+3,{x:50,y:1,z:4});fx.update(0,i*10+5,{});}
 assert.deepEqual(meshes.map(m=>[m.geometry.uuid,m.material.uuid]),ids);assert.equal(fx.root.visible,false);
 fx.dispose();assert.equal(disposals,4);
});
