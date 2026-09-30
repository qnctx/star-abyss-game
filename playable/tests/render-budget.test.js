const test=require('node:test'),assert=require('node:assert/strict');
const modulePromise=import('../src/render-budget.mjs');
test('persistent missed refreshes lower scale even when median remains 60 Hz',async()=>{
 const{createRenderBudget,sampleRenderBudget,recordRenderWork}=await modulePromise;
 for(const cpu of [5,20]){const s=createRenderBudget(1.25);let t=0;
 for(let i=0;i<1000;i++){recordRenderWork(s,cpu);sampleRenderBudget(s,t+=i%8===0?33.33:16.67);}
 assert.equal(cpu===5?s.ratio<1:s.ratio===1,true);}
});
test('render scale responds to sustained slow frames, stays bounded and recovers slowly',async()=>{
 const{createRenderBudget,sampleRenderBudget}=await modulePromise,s=createRenderBudget(2);let t=1;
 assert.equal(s.ratio,1);for(let i=0;i<3000;i++)sampleRenderBudget(s,t+=40);
 assert.equal(s.ratio,.9);for(let i=0;i<3000;i++)sampleRenderBudget(s,t+=16);
 assert.ok(s.ratio>.9&&s.ratio<=1);
});
test('CPU saturation and periodic 200 ms spikes cannot ratchet resolution down',async()=>{
 const{createRenderBudget,sampleRenderBudget,recordRenderWork}=await modulePromise;
 for(const cpu of [0,30]){const s=createRenderBudget(1.25);let t=0;for(let i=0;i<4000;i++){recordRenderWork(s,cpu);sampleRenderBudget(s,t+=cpu?40:i%120===0?200:16.67);}assert.equal(s.ratio,1);}
});
test('hysteresis separates changes by 4 seconds and bounds ratio at 0.9',async()=>{
 const{createRenderBudget,sampleRenderBudget}=await modulePromise,s=createRenderBudget(1);let t=0,last=-Infinity;
 for(let i=0;i<5000;i++){if(sampleRenderBudget(s,t+=i%400<200?30:16.67)){assert.ok(t-last>=4000);last=t;}assert.ok(s.ratio>=.9&&s.ratio<=1);}
});
test('device DPR above one is capped at one CSS pixel per device pixel',async()=>{
 const{createRenderBudget}=await modulePromise;
 for(const dpr of [1.5,2]){const state=createRenderBudget(dpr);assert.equal(state.ceiling,1);assert.equal(state.ratio,1);assert.equal(state.floor,.9);}
});
test('pause, invalid time and isolated stalls do not degrade the renderer',async()=>{
 const{createRenderBudget,sampleRenderBudget}=await modulePromise,s=createRenderBudget(1);let t=1;
 for(let i=0;i<100;i++)sampleRenderBudget(s,t+=16);
 for(const delta of [2000,4000,3000])sampleRenderBudget(s,t+=delta);
 for(let i=0;i<23;i++)sampleRenderBudget(s,t+=16);
 assert.equal(s.ratio,1);assert.equal(sampleRenderBudget(s,NaN),false);
});
