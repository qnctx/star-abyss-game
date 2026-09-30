const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let e;test.before(async()=>e=await import('../src/equipment-control.mjs'));
test('scanner starts empty, emits only after draw, folds and fully stows',()=>{
 const s=e.createEquipment();assert.equal(e.equipmentView(s).visible,false);assert.ok(e.useScanner(s));assert.equal(e.useScanner(s),false);
 assert.equal(e.updateEquipment(s,.54).emit,false);assert.equal(e.updateEquipment(s,.01).emit,true);assert.equal(s.phase,'using');
 assert.equal(e.updateEquipment(s,1.25).emit,false);assert.equal(s.phase,'folding');
 e.updateEquipment(s,.3);assert.equal(s.phase,'stowing');assert.equal(e.equipmentView(s).fins,0);
 e.updateEquipment(s,.5);assert.equal(s.item,null);assert.equal(e.equipmentView(s).visible,false);assert.ok(e.useScanner(s));assert.equal(s.serial,2);
});
test('interrupting a draw retracts from current exposure and never emits a scan',()=>{
 const s=e.createEquipment();e.useScanner(s);e.updateEquipment(s,.18);const before=e.equipmentView(s).exposure;e.stowEquipment(s);
 assert.equal(e.equipmentView(s).exposure,before);assert.equal(e.updateEquipment(s,2).emit,false);assert.equal(s.phase,'hidden');
});
test('lifecycle has identical outcome across frame partitions and zero time freezes it',()=>{
 for(const step of [1/144,1/60,.25,3]){const s=e.createEquipment();e.useScanner(s);let pulses=0;for(let t=0;t<3;t+=step)pulses+=Number(e.updateEquipment(s,Math.min(step,3-t)).emit);assert.equal(pulses,1);assert.equal(s.phase,'hidden');}
 const s=e.createEquipment();e.useScanner(s);e.updateEquipment(s,.6);const saved=JSON.stringify(s);e.updateEquipment(s,0);assert.equal(JSON.stringify(s),saved);
});
test('delivered GLB starts in visible neutral pose with real articulated groups',()=>{
 const b=fs.readFileSync(path.join(__dirname,'../assets/equipment/explorer-scanner-v1.glb'));assert.equal(b.toString('utf8',0,4),'glTF');const j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
 for(const name of ['ExplorerEquipment','Scanner','RightHand','LeftHand','FinL','FinR'])assert.ok(j.nodes.some(n=>n.name===name),name);
 const root=j.nodes.find(n=>n.name==='ExplorerEquipment');assert.ok((root.translation||[0,0,0]).every(v=>Math.abs(v)<1e-5),'Do not export stowed frame 1');assert.ok(Math.abs(root.rotation?.[0]||0)<1e-5);
 assert.ok(j.images.length>=2);assert.ok(j.meshes.length>=5);
});
