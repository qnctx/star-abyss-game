const test=require('node:test');
const assert=require('node:assert/strict');
let sampleClip,forwardPose,forwardFeet,gaitBaselineFingerprint,poseBaselineFingerprint;
test.before(async()=>{
  ({sampleClip,forwardPose,forwardFeet}=await import('../src/authored-motion.mjs'));
  ({gaitBaselineFingerprint,poseBaselineFingerprint}=await import('./gait-benchmark.mjs'));
});

test('directional poses retain optimization baseline; idle fix has a deterministic contact trajectory',()=>{
  // Recorded before optimization: 1,920 fixed 120 Hz ticks spanning forward,
  // reverse, left/right, rest, sprint, air and vehicle; pose values quantized to
  // 1e-8 tolerate arithmetic ordering only, not visible/contact logic changes.
  // 2026-09-09 intentionally pins idle pelvis/legs. Mixed trajectory now
  // includes that correction; pure directional clips remain bit-identical.
  assert.equal(gaitBaselineFingerprint(),'50f11d3ae3eb1da8366ce2c3a180ad91f7eab782766d27aad011a3ccaa7b89af');
  assert.equal(poseBaselineFingerprint(),'e2ec4583602968b2f6b08f07ee4849391ef52dc9690672f4947b2a77ef4acaea');
});

test('leg-only FK exactly matches full-rig FK across every source clip',()=>{
  for(const name of ['idle','walk','jog','sprint','flight','seated'])for(let i=0;i<120;i++){
    const pose=sampleClip(name,i/120),full=forwardPose(pose).feet,lean=forwardFeet(pose).feet;
    for(let k=0;k<2;k++){
      for(const property of ['sole','contact','ankle','rotation'])assert.deepEqual(lean[k][property].toArray(),full[k][property].toArray(),`${name}/${i}/${property}`);
      assert.equal(lean[k].contactZ,full[k].contactZ);
    }
  }
});

test('cached normalized source frames never share mutable output pose or FK transforms',()=>{
  const reference=sampleClip('jog',.31),expected=JSON.stringify(reference);
  const changed=sampleClip('jog',.31);changed.position[0]=999;changed.rotations[0].set(9,8,7,6);
  assert.equal(JSON.stringify(sampleClip('jog',.31)),expected);
  const feet=forwardFeet(reference);feet.feet[0].ankle.set(999,999,999);feet.feet[0].rotation.set(9,8,7,6);
  assert.equal(JSON.stringify(reference),expected);
});
