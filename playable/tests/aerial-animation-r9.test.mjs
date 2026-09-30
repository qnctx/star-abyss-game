import test from 'node:test';import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {yuanYingFlightPose,createYuanYingFlightAnimator} from '../src/yuan-ying-flight-pose.mjs';
import {meleePoseTiming,createAerialMeleeAnimator} from '../src/aerial-melee-animation.mjs';
import {sampleAirCombatPose} from '../src/air-combat-pose.mjs';
test('cruise remains upright while boost rotates whole pelvis axis forward almost horizontally',()=>{
 const cruise=yuanYingFlightPose({active:true,speed:600,agl:1600,boosting:false});
 const boost=yuanYingFlightPose({active:true,speed:600,agl:1600,boosting:true});
 const axis=p=>new Vector3(0,1,0).applyQuaternion(new Quaternion().fromArray(p.rotations[0]));
 assert.ok(axis(cruise).y>.95);assert.ok(axis(boost).z<-.9);assert.ok(Math.abs(axis(boost).y)<.35);
});
test('fast alternating bank requests keep animation quaternion transitions bounded and preserve boost lean',()=>{
 const controller=createYuanYingFlightAnimator(),base=sampleAirCombatPose('hover',0);let previous=null;
 for(let i=0;i<300;i++){const pose=controller.update({active:true,boosting:true,speed:1500,agl:1600,turnBank:i%12<6?1:-1},i/60,1/60,base),q=new Quaternion().fromArray(pose.rotations[0]);if(previous)assert.ok(previous.angleTo(q)<.12);previous=q.clone();}
 assert.ok(controller.snapshot().boost>.99);
});
test('contact frame maps to authored .45 peak and reaction overrides offense',()=>{
 assert.equal(meleePoseTiming({move:'jab',start:1,contact:1.16,end:1.4},1.16).progress,.45);
 assert.equal(meleePoseTiming({move:'kick',start:1,contact:1.3,end:1.7,reaction:{kind:'launch',start:1.2,end:1.75}},1.4).clip,'launch');
 assert.equal(meleePoseTiming({guarding:true},2).clip,'air-guard');assert.equal(meleePoseTiming({move:'jab',end:1},2),null);
 const controller=createAerialMeleeAnimator(),base=sampleAirCombatPose('hover',0);for(let i=0;i<30;i++)controller.update(base,{guarding:true},i/60,1/60);assert.ok(controller.snapshot().weight>.99);
 for(let i=0;i<40;i++)controller.update(base,null,1+i/60,1/60);assert.equal(controller.snapshot().weight,0);
});
test('combo recovery keeps a ready arm pose across the cast gap and releases on guard or idle',()=>{
 const animator=createAerialMeleeAnimator(),base=sampleAirCombatPose('hover',0),state={move:'jab',start:0,contact:.16,end:.4};
 for(let i=0;i<=24;i++)animator.update(base,state,i/60,1/60);
 const bridge=animator.update(base,{...state,move:null},.45,1/60);
 assert.equal(animator.snapshot().clip,'ready');assert.ok(animator.snapshot().weight>.99);
 assert.ok(new Quaternion().fromArray(bridge.rotations[6]).angleTo(new Quaternion().fromArray(base.rotations[6]))>.2);
 const next={move:'cross',start:.46,contact:.67,end:.95};animator.update(base,next,.47,1/60);assert.equal(animator.snapshot().clip,'right-cross');
 animator.update(base,{guarding:true},.49,1/60);assert.equal(animator.snapshot().clip,'air-guard');
 for(let i=0;i<40;i++)animator.update(base,null,1+i/60,1/60);assert.equal(animator.snapshot().weight,0);
});
