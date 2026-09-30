const test=require('node:test');
const assert=require('node:assert/strict');

test('stationary idle keeps pelvis, legs and sole anchors fixed across repeated breathing loops',async()=>{
  const {createGait,updateGait,gaitView}=await import('../src/gait.mjs');
  const {CLIP_INFO}=await import('../src/authored-motion.mjs');
  for(const slope of [0,.08]){
    const player={x:0,y:0,z:0,heading:0,yaw:0};
    const gait=createGait(player,(x,z)=>({height:slope*x,surface:'stone'}));
    const start=gaitView(gait);let upperChanged=false,maxDrift=0;
    for(let i=0;i<Math.ceil(CLIP_INFO.idle.duration*3*60);i++){
      player.yaw+=.002; // Looking around must not move the supporting legs.
      const events=updateGait(gait,{player,dt:1/60,grounded:true});
      const view=gaitView(gait);assert.equal(events.length,0);
      for(let k=0;k<2;k++)for(const axis of ['x','y','z'])maxDrift=Math.max(maxDrift,Math.abs(view.feet[k].raw[axis]-start.feet[k].raw[axis]));
      for(const bone of [0,13,14,15,16,17,18])assert.deepEqual(view.pose.rotations[bone],start.pose.rotations[bone],`idle lower-body bone ${bone} must not oscillate`);
      upperChanged ||= JSON.stringify(view.pose.rotations[3])!==JSON.stringify(start.pose.rotations[3]);
    }
    assert.ok(maxDrift<1e-8,`stationary contact drift ${maxDrift}m`);
    assert.ok(upperChanged,'retain upper-body breathing, do not freeze the entire character');
  }
});
