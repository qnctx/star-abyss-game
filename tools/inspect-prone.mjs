import fs from 'node:fs';import {pronePose}from'../playable/src/tactical-pose.mjs';import {forwardPose}from'../playable/src/authored-motion.mjs';import{HUMANOID_RIG}from'../playable/src/humanoid-rig.mjs';
const b=fs.readFileSync('playable/assets/characters/c2-explorer.glb'),j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());for(const n of j.nodes)if(n.extras?.c2NativeRig)console.log(n.extras.c2NativeRig);
console.log(forwardPose(pronePose(0,0,{forward:1,backward:0,left:0,right:0})).positions.map((p,i)=>[HUMANOID_RIG[i][0],p.toArray()]));
