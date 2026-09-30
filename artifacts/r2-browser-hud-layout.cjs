const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),{chromium}=require('@playwright/test');
const out=path.resolve('artifacts/r2-browser-hud-final');fs.mkdirSync(out,{recursive:true});
(async()=>{let browser;const report={checks:[],errors:[],complete:false};try{
 browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>report.errors.push(e.message));
 const bundle=new Promise(resolve=>page.on('response',async r=>{if(new URL(r.url()).pathname.endsWith('/game.js'))resolve(crypto.createHash('sha256').update(await r.body()).digest('hex'));}));
 await page.goto('http://127.0.0.1:4180/star-abyss.html?testLab=1&test=1&expeditionDebug=1');report.bundleSHA=await bundle;
 await page.waitForFunction(()=>window.__STAR_ABYSS_LAB__?.snapshot().lab.ready,null,{timeout:120000});
 const panel=page.locator('#test-lab-panel');if(!await panel.isVisible())await page.evaluate(()=>window.__STAR_ABYSS_LAB__.show());
 await page.locator('#test-lab-height').selectOption('2000');await page.locator('#test-lab-panel [data-action=height]').click();await page.waitForFunction(()=>document.querySelector('#test-lab-panel').dataset.busy==='false');
 await page.locator('#test-lab-panel [data-action=close]').click();await page.locator('#world').click({position:{x:720,y:400}});
 for(const [width,height] of [[1440,900],[900,500],[670,700],[390,640]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(350);await page.keyboard.press('KeyV');await page.locator('#toast').waitFor({state:'visible',timeout:3000});
  const metrics=await page.evaluate(()=>{const selectors={toast:'#toast',location:'#hud .location',readout:'#hud .flight-readout',controls:'#hud .hud-controls',badge:'#test-lab-toggle',objective:'#hud .objective'};const boxes={};for(const [id,selector] of Object.entries(selectors)){const el=document.querySelector(selector);if(!el)continue;const r=el.getBoundingClientRect(),style=getComputedStyle(el);if(el.hidden||style.display==='none'||style.visibility==='hidden')continue;boxes[id]={x:r.x,y:r.y,w:r.width,h:r.height,scrollW:el.scrollWidth,clientW:el.clientWidth,scrollH:el.scrollHeight,clientH:el.clientHeight,text:el.textContent.trim().slice(0,180)};}const toast=boxes.toast,overlaps=[];if(toast)for(const id of ['location','readout','controls','badge','objective']){const r=boxes[id];if(r&&Math.min(toast.x+toast.w,r.x+r.w)>Math.max(toast.x,r.x)&&Math.min(toast.y+toast.h,r.y+r.h)>Math.max(toast.y,r.y))overlaps.push(id);}const buttons=[...document.querySelectorAll('#hud .hud-controls button')].map(b=>{const r=b.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {text:b.textContent.trim(),inside:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,clickable:b.contains(hit)}});return {boxes,overlaps,buttons,viewport:{width:innerWidth,height:innerHeight},cameraMode:window.__STAR_ABYSS_TEST__.snapshot().cameraMode};});
  await page.screenshot({path:path.join(out,'toast-'+width+'x'+height+'.png')});report.checks.push({width,height,...metrics});
  assert(metrics.boxes.toast,'V switch toast not visible');assert.equal(metrics.overlaps.length,0,'Toast overlaps '+metrics.overlaps.join(','));
  assert(metrics.boxes.toast.x>=0&&metrics.boxes.toast.y>=0&&metrics.boxes.toast.x+metrics.boxes.toast.w<=width&&metrics.boxes.toast.y+metrics.boxes.toast.h<=height,'Toast outside viewport');
  assert(metrics.boxes.toast.scrollW<=metrics.boxes.toast.clientW+1&&metrics.boxes.toast.scrollH<=metrics.boxes.toast.clientH+1,'Toast Chinese text clipped');
  assert(metrics.buttons.every(b=>b.inside&&b.clickable),'HUD controls not visible or clickable');
 }
 assert.deepEqual(report.errors,[]);report.complete=true;
 }catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser?.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({complete:report.complete,failure:report.failure,bundleSHA:report.bundleSHA,checks:report.checks.map(c=>({width:c.width,height:c.height,cameraMode:c.cameraMode,toast:c.boxes.toast,overlaps:c.overlaps,buttons:c.buttons}))},null,2));}})();
