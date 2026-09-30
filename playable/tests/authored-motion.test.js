const test=require('node:test'),assert=require('node:assert/strict');
let sampleClip,forwardPose,CLIP_INFO,data,createGait,updateGait,gaitView,directionalPose,locomotionPose;
test.before(async()=>{
  ({sampleClip,forwardPose,CLIP_INFO,directionalPose,locomotionPose}=await import('../src/authored-motion.mjs'));
  data=(await import('../src/authored-motion-data.mjs')).default;
  ({createGait,updateGait,gaitView}=await import('../src/gait.mjs'));
});

test('forward adaptation is exact; back and side poses bend knees and preserve non-crossing feet throughout the cycle',()=>{
  const directions=[{forward:0,backward:1,left:0,right:0},{forward:0,backward:0,left:1,right:0},{forward:0,backward:0,left:0,right:1}];
  for(const style of [{walk:1,jog:0,sprint:0},{walk:0,jog:1,sprint:0},{walk:0,jog:0,sprint:1}]){
    let minBend=Infinity,maxBend=0;
    for(let i=0;i<120;i++){
      const phase=i/120,source=locomotionPose(style,phase);
      assert.deepEqual(directionalPose(style,phase,{forward:1,backward:0,left:0,right:0}),source);
      for(const direction of directions){
        const pose=directionalPose(style,phase,direction),fk=forwardPose(pose);
        assert.ok(fk.feet[1].ankle.x-fk.feet[0].ankle.x>.18,'boots keep lateral clearance');
        for(const q of pose.rotations)assert.ok(Math.abs(q.length()-1)<1e-5);
        for(const hip of [13,16]){
          const thigh=fk.positions[hip+1].clone().sub(fk.positions[hip]),shin=fk.positions[hip+2].clone().sub(fk.positions[hip+1]);
          assert.ok(Math.abs(thigh.length()-.445)<1e-8);assert.ok(Math.abs(shin.length()-.445)<1e-8);
          const bend=thigh.angleTo(shin);minBend=Math.min(minBend,bend);maxBend=Math.max(maxBend,bend);
          assert.ok(fk.positions[hip+1].z<(fk.positions[hip].z+fk.positions[hip+2].z)/2,'knees bend forward, never backward');
        }
        for(const foot of fk.feet)assert.ok(foot.contact.y>-.025,'retargeted feet do not sink below calibrated floor');
      }
    }
    assert.ok(minBend>.15 && maxBend-minBend>.2,'knees flex through the stride, not rigid hip swinging');
  }
});
for(const name of ['idle','walk','jog','sprint','flight','seated'])test(`${name}: licensed whole-body frames, normalized quaternions and fixed bone lengths`,()=>{
  assert.match(data.source,/CC0/);assert.equal(data.bones,19);assert.ok(data.clips[name].frames.length>30);
  const seen=new Set();
  for(let i=0;i<120;i++){
    const pose=sampleClip(name,i/120),fk=forwardPose(pose);seen.add(pose.rotations.flatMap(q=>q.toArray()).join(','));
    for(const q of pose.rotations)assert.ok(Math.abs(q.length()-1)<1e-5);
    for(const[a,b,length]of[[13,14,.445],[14,15,.445],[16,17,.445],[17,18,.445],[6,7,.30],[7,8,.277]])assert.ok(Math.abs(fk.positions[a].distanceTo(fk.positions[b])-length)<1e-8);
    assert.ok(fk.positions.flatMap(p=>p.toArray()).every(Number.isFinite));
  }
  assert.ok(seen.size>15);assert.ok(CLIP_INFO[name].stride>0);
});
test('loop seams are continuous and jog/sprint are different full-body clips',()=>{
  for(const name of ['walk','jog','sprint']){
    const a=sampleClip(name,.99999),b=sampleClip(name,0);
    assert.ok(Math.hypot(...a.position.map((v,i)=>v-b.position[i]))<.002);
    for(let i=0;i<19;i++)assert.ok(a.rotations[i].angleTo(b.rotations[i])<.015);
  }
  assert.notDeepEqual(data.clips.jog.frames,data.clips.sprint.frames);
});
const headings={forward:[0,-1],backward:[0,1],left:[-1,0],right:[1,0]};
for(const speed of [1.65,4.7,8.6])for(const[name,direction]of Object.entries(headings))test(`${speed} m/s ${name}: directional pose preserves body heading and physics`,()=>{
  const player={x:0,y:0,z:0,yaw:0},ground=()=>({height:0,surface:'dust'}),state=createGait(player,ground);
  let contacts=0,previousYaw=0;
  for(let i=0;i<480;i++){
    player.x+=direction[0]*speed/120;player.z+=direction[1]*speed/120;
    contacts+=updateGait(state,{player,dt:1/120,grounded:true,sampleGround:ground}).length;
    const view=gaitView(state),turn=Math.atan2(Math.sin(view.facing-previousYaw),Math.cos(view.facing-previousYaw));
    assert.ok(Math.abs(turn)<=5.5/120+1e-8);previousYaw=view.facing;
    assert.ok(view.pose.rotations.flat().every(Number.isFinite));assert.equal(player.yaw,0);assert.ok(view.direction[name]>.99);
    for(const f of view.feet){assert.ok(f.y>=0);assert.ok(Math.hypot(f.correction.x,f.correction.z)<.091);}
  }
  assert.equal(state.facing,0);
  assert.ok(contacts>=5);assert.ok(Math.abs(player.x-direction[0]*speed*4)<1e-7);assert.ok(Math.abs(player.z-direction[1]*speed*4)<1e-7);
});
test('start, stop and turn blend whole-body poses, idle breathes without footstep loops',()=>{
  const player={x:0,y:0,z:0,yaw:0},state=createGait(player,()=>({height:0})),transitions=new Set();
  for(let i=0;i<300;i++){
    if(i<120)player.z-=1.65/120;
    updateGait(state,{player,dt:1/120,grounded:true});transitions.add(state.transition);
  }
  assert.ok(['start','travel','stop','idle'].every(s=>transitions.has(s)));
  const before=gaitView(state),count=state.stepCount;
  for(let i=0;i<100;i++)updateGait(state,{player,dt:1/120,grounded:true});
  assert.equal(state.stepCount,count);assert.equal(state.phase,before.phase);assert.notDeepEqual(state.pose.rotations,before.pose.rotations);
  const view=gaitView(state);view.pose.rotations[0][0]=999;assert.notEqual(state.pose.rotations[0][0],999);
});
