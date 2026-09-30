import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3,Quaternion} from 'three';
import {HUMANOID_RIG} from '../../../playable/src/humanoid-rig.mjs';
import data from '../../../playable/assets/air-combat-r9/air-combat-clips.mjs';
import {sampleAirCombatPose,createAirCombatPose,AIR_COMBAT_CLIPS} from '../../../playable/src/air-combat-pose.mjs';
const checks=JSON.parse(fs.readFileSync(new URL('../../../docs/art/air-combat-r9/native-joint-checks.json',import.meta.url),'utf8'));
assert.deepEqual(data.boneNames,HUMANOID_RIG.map(r=>r[0]));assert.equal(Object.keys(AIR_COMBAT_CLIPS).length,8);
const out=createAirCombatPose();for(const id of Object.keys(AIR_COMBAT_CLIPS))for(let i=0;i<=100;i++){
 assert.equal(sampleAirCombatPose(id,i/100,out),out);assert(out.position.every(Number.isFinite));
 for(const q of out.rotations){assert(q.every(Number.isFinite));assert(Math.abs(Math.hypot(...q)-1)<1e-6);}
}
for(const id of ['left-jab','right-cross','rising-kick']){
 assert.equal(AIR_COMBAT_CLIPS[id].peak,.45);assert.deepEqual(sampleAirCombatPose(id,0),sampleAirCombatPose(id,1));
}
const boost=checks.boost;assert(boost.head[2]<boost.pelvis[2]-.6);assert(boost.head[1]>boost.pelvis[1],'Boost must never invert head below pelvis');assert(Math.abs(boost.head[1]-boost.pelvis[1])<.15,'Boost torso near horizontal');
for(const side of ['L','R']){
 assert(boost['ankle'+side][2]>boost.pelvis[2]+.7,'Boost legs trail behind');
 const hip=new Vector3(...boost['hip'+side]),knee=new Vector3(...boost['knee'+side]),ankle=new Vector3(...boost['ankle'+side]);assert(knee.clone().sub(hip).normalize().dot(ankle.clone().sub(knee).normalize())>.93,'Boost legs stay nearly straight');
}
const pose=sampleAirCombatPose('boost',.5);let world=new Quaternion();for(const i of [0,1,2,3,4])world.multiply(new Quaternion().fromArray(pose.rotations[i]));const gaze=new Vector3(0,0,-1).applyQuaternion(world);assert(gaze.z<-.97&&Math.abs(gaze.y)<.2,'Boost gaze forward, not into ground');
assert(checks['left-jab'].wristL[2]<-.5);assert(checks['right-cross'].wristR[2]<-.5);assert(checks['rising-kick'].ankleR[1]>checks['rising-kick'].pelvis[1]+.35);
const report={version:data.version,clips:8,bones:19,samplesChecked:808,contactProgress:.45,normalizedQuaternions:true,boost:{headAheadAndAboveHips:true,torsoNearHorizontal:true,legsStraightAndBehind:true,gaze:gaze.toArray()},punchesExtendForward:true,kickRisesAbovePelvis:true};
fs.writeFileSync(new URL('../../../docs/art/air-combat-r9/verification.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
