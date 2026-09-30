const {chromium}=require('@playwright/test');
const fs=require('node:fs');const path=require('node:path');
(async()=>{
 const label=process.argv[2]||'current';if(!/^[a-z-]+$/.test(label))throw Error('invalid label');
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto('file:///'+path.resolve('playable/star-abyss.html').replace(/\\/g,'/')+'?test=1');await page.locator('#start-button').click();await page.keyboard.press('KeyV');
  const graphics=await page.evaluate(()=>{const gl=document.getElementById('world').getContext('webgl2'),info=gl?.getExtension('WEBGL_debug_renderer_info');return info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):'driver not exposed';});
  await page.waitForTimeout(1800);await page.keyboard.down('KeyW');
  const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
  const samples=await page.evaluate(()=>new Promise(resolve=>{let previous=performance.now();const values=[];function sample(now){values.push(now-previous);previous=now;if(values.length===120)resolve(values.slice(10));else requestAnimationFrame(sample);}requestAnimationFrame(sample);}));
  const {profile}=await cdp.send('Profiler.stop');await page.keyboard.up('KeyW');
  const nodes=new Map(profile.nodes.map(n=>[n.id,n.callFrame])),counts=new Map();
  for(const id of profile.samples||[]){const n=nodes.get(id);const name=(n?.functionName||'(anonymous)')+' @ '+(n?.url?.split('/').pop()||'native');counts.set(name,(counts.get(name)||0)+1);}
  samples.sort((a,b)=>a-b);const state=await page.evaluate(()=>__STAR_ABYSS_TEST__.snapshot());
  const result={label,viewport:'1440x900 headless Chromium; not the user browser FPS',graphics,renderRatio:state.renderRatio??1,frameMs:{p50:samples[Math.floor(samples.length*.5)],p95:samples[Math.floor(samples.length*.95)],max:Math.max(...samples)},drawCalls:state.calls,triangles:state.triangles,hotspots:[...counts].sort((a,b)=>b[1]-a[1]).slice(0,16)};
  fs.writeFileSync(path.resolve('docs/ui-implementation/locomotion-profile-'+label+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
