const {chromium}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/tactical-control-20260912');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true});const errors=[],report={};try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file:///'+path.join(root,'playable/star-abyss.html').replace(/\\/g,'/')+'?test=1');
 await page.locator('#start-button').click();await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().locked&&__STAR_ABYSS_TEST__.snapshot().avatarPose.characterAsset.status==='ready');
 const snap=()=>page.evaluate(()=>__STAR_ABYSS_TEST__.snapshot());
 const settle=async()=>{const t=(await snap()).elapsed;await page.waitForFunction(t=>__STAR_ABYSS_TEST__.snapshot().elapsed>t+.7,t);};
 await page.keyboard.press('KeyV');await settle();report.stand=await snap();
 await page.keyboard.press('KeyC');await settle();report.crouch=await snap();assert.equal(report.crouch.player.posture,'crouch');
 assert.ok(report.crouch.avatarPose.pelvis.position[1]<report.stand.avatarPose.pelvis.position[1]-.2);
 await page.screenshot({path:path.join(out,'crouch.png')});
 await page.keyboard.press('KeyZ');await settle();report.prone=await snap();assert.equal(report.prone.gait.transition,'prone');assert.ok(report.prone.cameraRig.avatarVisible,'Prone third-person camera must show the real character');
 await page.screenshot({path:path.join(out,'prone.png')});
 await page.keyboard.press('KeyZ');await settle();
 await page.keyboard.press('KeyV');await page.keyboard.press('KeyQ');await settle();report.scan=await snap();assert.equal(report.scan.player.lean,0);assert.ok(report.scan.scannerCooldown>0);
 await page.keyboard.down('ControlLeft');await page.keyboard.down('KeyW');await settle();report.walk=await snap();assert.ok(report.walk.controls.walk);assert.ok(Math.hypot(report.walk.player.vx,report.walk.player.vz)<1.7);await page.keyboard.up('ControlLeft');await page.keyboard.up('KeyW');
 await page.keyboard.press('Equal');await settle();report.autoRun=await snap();assert.ok(report.autoRun.controls.autoRun&&Math.hypot(report.autoRun.player.vx,report.autoRun.player.vz)>4);
 await page.keyboard.press('KeyS');await settle();assert.equal((await snap()).controls.autoRun,false);
 await page.evaluate(()=>__STAR_ABYSS_TEST__.freezeFrame(true));await page.keyboard.down('Space');await page.evaluate(()=>__STAR_ABYSS_TEST__.advance(.1,__STAR_ABYSS_TEST__.snapshot().controls));report.jump=await snap();assert.equal(report.jump.mobility.jump.airborne,true);assert.equal(report.jump.mobility.flight.airborne,false);assert.equal(report.jump.mobility.flight.energy,100);
 await page.keyboard.up('Space');await page.evaluate(()=>__STAR_ABYSS_TEST__.freezeFrame(false));await page.waitForFunction(()=>!__STAR_ABYSS_TEST__.snapshot().mobility.jump.airborne);report.landed=await snap();
 await page.keyboard.press('KeyX');assert.ok((await snap()).scannerCooldown>0);
 await page.keyboard.press('KeyM');await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().screen==='journal');await page.keyboard.press('KeyM');await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().screen==='playing');
 await page.keyboard.press('Equal');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal((await snap()).controls.autoRun,false);
 report.layouts=[];
 for(const width of [1440,768,640]){await page.setViewportSize({width,height:900});report.layouts.push(await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth})));}
 assert.ok(report.layouts.every(x=>!x.overflow));assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'browser-audit.json'),JSON.stringify({status:'passed',errors,...report},null,2));console.log(JSON.stringify({status:'passed',crouchPelvis:report.crouch.avatarPose.pelvis.position,pronePelvis:report.prone.avatarPose.pelvis.position,walkSpeed:Math.hypot(report.walk.player.vx,report.walk.player.vz),errors}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
