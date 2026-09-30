// Rendering only: never alter simulation, collision, animation or UI scale.
// 60 Hz target; 0.90 CSS pixels is the explicit minimum, not the old 0.65.
export function createRenderBudget(deviceRatio=1){
 const ceiling=Math.max(.9,Math.min(1,Number.isFinite(deviceRatio)?deviceRatio:1));
 return {ratio:ceiling,ceiling,floor:.9,last:null,started:null,samples:[],cpuSamples:[],settle:0,slow:0,fast:0,cpuMs:0,reason:'warmup',frameBudgetMs:16.67};
}
export function recordRenderWork(state,cpuMs){state.cpuMs=Number.isFinite(cpuMs)?Math.max(0,cpuMs):0;}
export function sampleRenderBudget(state,now){
 if(!Number.isFinite(now))return false;
 const last=state.last;state.last=now;state.started??=now;
 if(last===null)return false;
 const dt=now-last;
 if(dt<=0||dt>250){state.samples.length=state.cpuSamples.length=0;state.slow=state.fast=0;state.reason='discontinuity';return false;}
 if(now-state.started<2000||now<state.settle)return false;
 state.samples.push(dt);state.cpuSamples.push(state.cpuMs);
 if(state.samples.length<60)return false;
 const frames=state.samples.sort((a,b)=>a-b),cpu=state.cpuSamples.sort((a,b)=>a-b);
 const median=frames[30],p75=frames[45],cpuP75=cpu[45];
 const missed=frames.filter(ms=>ms>25).length/frames.length;
 state.samples=[];state.cpuSamples=[];
 let next=state.ratio;
 // A CPU stall cannot be repaired by discarding pixels. Robust windows prevent
 // a periodic checkpoint/streaming outlier from ratcheting quality down.
 if(cpuP75>8&&cpuP75>median*.45){state.reason='cpu-bound';state.slow=state.fast=0;return false;}
 if(median>23&&p75>25||missed>=.08){state.fast=0;state.reason='sustained-pressure';if(++state.slow>=3){next=Math.max(state.floor,state.ratio-.05);state.slow=0;}}
 else if(median<18.5&&p75<20&&missed<.02){state.slow=0;state.reason='headroom';if(++state.fast>=3){next=Math.min(state.ceiling,state.ratio+.05);state.fast=0;}}
 else {state.fast=state.slow=0;state.reason='stable';}
 if(Math.abs(next-state.ratio)<.001)return false;
 state.ratio=Number(next.toFixed(2));state.settle=now+4000;return true;
}
