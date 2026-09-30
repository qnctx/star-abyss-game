const test=require('node:test'),assert=require('node:assert/strict');
test('editable vehicle GLB comes from the current in-game geometry, with shared dashboard and grip groups',()=>{
 const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),root=path.resolve(__dirname,'../..'),dir=path.join(root,'playable/assets/vehicles');
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'source-manifest.json'))),b=fs.readFileSync(path.join(dir,'survey-skimmer-cockpit-v1.glb')),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 assert.equal(hash(b),manifest.asset);for(const [file,h]of Object.entries(manifest.sources))assert.equal(hash(fs.readFileSync(path.join(root,file))),h);
 const j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());for(const name of ['skimmer-cockpit','live-dashboard','steering-and-grips'])assert.ok(j.nodes.some(n=>n.name===name),name);
 assert.ok(j.images.length>=2);assert.ok(fs.statSync(path.join(dir,'survey-skimmer-cockpit-v1.blend')).size>100000);
});
test('cockpit eye is seated in chassis coordinates and does not orbit on mouse look',async()=>{
 const {resolveCamera}=await import('../src/camera.mjs');const p={x:0,z:190,y:0,yaw:0,pitch:0,vehicleYaw:Math.PI/2,eyeHeight:.38,lean:1};
 const a=resolveCamera(p,'vehicle-first'),b=resolveCamera({...p,yaw:2,pitch:.4},'vehicle-first');
 assert.equal(a.mode,'vehicle-first');assert.equal(a.avatarVisible,false);assert.deepEqual(a.position,b.position);assert.equal(a.position.y,1.88);assert.ok(Math.abs(a.position.x-.13)<1e-6);assert.notDeepEqual(a.target,b.target);
 assert.equal(resolveCamera(p,'vehicle').mode,'vehicle');assert.equal(resolveCamera(p,'first').mode,'first');
});
test('Alt return inside cockpit targets vehicle heading without steering the vehicle',async()=>{
 const {createLookControl,setFreeLook,applyMouseLook,updateLookControl}=await import('../src/look-control.mjs');const s=createLookControl(),p={yaw:1,heading:0,pitch:-.12};
 setFreeLook(s,p,true);applyMouseLook(s,p,200,80,{mounted:true});assert.equal(p.heading,0);setFreeLook(s,p,false);
 for(let i=0;i<120;i++)updateLookControl(s,p,1/60,{mounted:true,vehicleHeading:1});assert.equal(s.returning,false);assert.equal(p.yaw,1);assert.ok(Math.abs(p.pitch+.12)<1e-6);assert.equal(p.heading,0);
});
