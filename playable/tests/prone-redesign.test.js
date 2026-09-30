const {test,before}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
let p,m;const direction={forward:1,backward:0,left:0,right:0};
before(async()=>{p=await import('../src/tactical-pose.mjs');m=await import('../src/authored-motion.mjs');});
test('prone cycle keeps a low torso, bent supporting arms and intact limb lengths',()=>{
 for(let i=0;i<60;i++){
  const pose=p.pronePose(i/60,1,direction),fk=m.forwardPose(pose),v=fk.positions;
  for(const q of pose.rotations)assert.ok(Math.abs(q.length()-1)<1e-8);
  assert.ok(v[0].y<.3&&v[4].z<-.5);
  for(const start of [6,10,13,16]){
   assert.ok(v[start+1].y>.02&&v[start+2].y>.02);
   assert.ok(Math.abs(v[start].distanceTo(v[start+1])-(start<13?.3:.445))<1e-8);
   assert.ok(Math.abs(v[start+1].distanceTo(v[start+2])-(start<13?.277:.445))<1e-8);
  }
  assert.ok(v[8].z<v[3].z&&v[12].z<v[3].z);assert.ok(Math.min(v[8].z,v[12].z)<v[4].z);assert.ok(v[15].z>.5&&v[18].z>.5);
 }
});
test('down transition starts at standing and ends at the same prone pose without abrupt position jumps',()=>{
 const base=m.sampleClip('idle',0),end=p.pronePose(0,0,direction);
 assert.deepEqual(p.proneTransitionPose(base,0,0,0,direction).position,base.position);
 assert.deepEqual(p.proneTransitionPose(base,1,0,0,direction).position,end.position);
 let last=base.position;
 for(let i=1;i<=90;i++){const pose=p.proneTransitionPose(base,i/90,0,0,direction);assert.ok(Math.hypot(...pose.position.map((v,j)=>v-last[j]))<.06);last=pose.position;}
});
test('delivered animated 3D matches the runtime sources and includes four native-rig clips',()=>{
 const root=path.resolve(__dirname,'../..'),dir=path.join(root,'playable/assets/animations/prone-v2'),manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
 const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 for(const [file,sha]of Object.entries(manifest.sources))assert.equal(hash(fs.readFileSync(path.join(root,file))),sha,file);
 const glb=fs.readFileSync(path.join(dir,'c2-prone-v2.glb'));assert.equal(hash(glb),manifest.asset);
 const json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
 assert.equal(manifest.joints,19);assert.deepEqual(json.animations.map(a=>a.name),['ProneDown','ProneIdle','ProneCrawl','ProneUp']);assert.ok(fs.statSync(path.join(dir,'c2-prone-v2.blend')).size>100000);
});
