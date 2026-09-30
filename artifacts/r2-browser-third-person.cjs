const fs=require('fs'),path=require('path'),crypto=require('crypto'),{chromium}=require('@playwright/test');
const out=path.resolve(process.env.R2_THIRD_OUT||'artifacts/r2-browser-third-person-attempt2');fs.mkdirSync(out,{recursive:true});
(async()=>{let browser;const report={errors:[]};try{
 browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>report.errors.push(e.message));
 const bundle=new Promise(resolve=>page.on('response',async r=>{if(new URL(r.url()).pathname.endsWith('/game.js'))resolve(crypto.createHash('sha256').update(await r.body()).digest('hex'));}));
 await page.goto('http://127.0.0.1:4180/star-abyss.html?testLab=1&test=1&expeditionDebug=1');report.bundleSHA=await bundle;
 await page.waitForFunction(()=>window.__STAR_ABYSS_LAB__?.snapshot().lab.ready,null,{timeout:120000});
 const panel=page.locator('#test-lab-panel');
 async function lab(action,height){if(!await panel.isVisible())await page.evaluate(()=>window.__STAR_ABYSS_LAB__.show());await panel.waitFor();if(height)await page.locator('#test-lab-height').selectOption(height);await page.locator('#test-lab-panel [data-action='+action+']').click();await page.waitForFunction(()=>document.querySelector('#test-lab-panel').dataset.busy==='false');if(await panel.isVisible())await page.locator('#test-lab-panel [data-action=close]').click();await page.waitForTimeout(300);await page.locator('#world').click({position:{x:720,y:400}});await page.waitForTimeout(300);}
 const snap=()=>page.evaluate(()=>{const s=window.__STAR_ABYSS_TEST__.snapshot();return {player:s.player,cameraMode:s.cameraMode,cameraRig:s.cameraRig,avatarPose:s.avatarPose,flight:s.planet?.session?.flight}});
 await lab('camp');await lab('height','2000');await page.keyboard.press('KeyV');await page.waitForTimeout(600);
 report.hover=await snap();await page.screenshot({path:path.join(out,'third-hover.png')});
 await page.keyboard.down('KeyW');await page.waitForTimeout(1800);report.forward=await snap();await page.screenshot({path:path.join(out,'third-forward.png')});
 await page.mouse.move(940,400);await page.waitForTimeout(900);report.turn=await snap();await page.screenshot({path:path.join(out,'third-turn.png')});
 if(process.env.R2_THIRD_PROFILE==='1'){const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');report.profileBefore=await snap();await page.waitForTimeout(9000);const result=await cdp.send('Profiler.stop');report.profileAfter=await snap();fs.writeFileSync(path.join(out,'high-flight.cpuprofile'),JSON.stringify(result.profile));}
 await page.keyboard.up('KeyW');
 report.complete=true;
 }catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser?.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({complete:report.complete,failure:report.failure,bundleSHA:report.bundleSHA,hover:report.hover&&{cameraMode:report.hover.cameraMode,avatar:report.hover.cameraRig?.avatarVisible},forward:report.forward&&{cameraMode:report.forward.cameraMode,position:report.forward.player,flight:report.forward.flight},turn:report.turn&&{cameraMode:report.turn.cameraMode,position:report.turn.player,flight:report.turn.flight},profileDelta:report.profileBefore&&report.profileAfter&&{z:report.profileAfter.player.z-report.profileBefore.player.z,y:report.profileAfter.player.y-report.profileBefore.player.y}}));}})();
