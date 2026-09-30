const {chromium}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/prone-redesign-20260912');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true});const errors=[],report={};try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file:///'+path.join(root,'playable/star-abyss.html').replace(/\\/g,'/')+'?test=1');await page.locator('#start-button').click();await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().avatarPose.characterAsset.status==='ready');
 const snap=()=>page.evaluate(()=>__STAR_ABYSS_TEST__.snapshot());await page.evaluate(()=>__STAR_ABYSS_TEST__.place({x:0,z:170,yaw:0}));await page.keyboard.press('KeyZ');await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().gait.proneBlend===1);
 let s=await snap();report.first={camera:s.camera,rig:s.cameraRig,joints:s.avatarPose.characterAsset.retarget.proneJoints};assert.ok(s.camera[2]<s.player.z-.5);assert.ok(s.camera[1]-s.player.y>.18&&s.camera[1]-s.player.y<.6);
 await page.screenshot({path:path.join(out,'first-person.png')});await page.evaluate(()=>__STAR_ABYSS_TEST__.look(0,-.50));await page.screenshot({path:path.join(out,'first-person-look-down.png')});
 await page.keyboard.press('KeyV');await page.evaluate(()=>__STAR_ABYSS_TEST__.look(0,0));await page.screenshot({path:path.join(out,'prone-rear.png')});
 await page.evaluate(()=>__STAR_ABYSS_TEST__.look(Math.PI/2,-.12));await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().camera[0]>2);await page.screenshot({path:path.join(out,'prone-side.png')});
 await page.evaluate(()=>__STAR_ABYSS_TEST__.look(Math.PI,-.15));await page.screenshot({path:path.join(out,'prone-front.png')});
 await page.evaluate(()=>__STAR_ABYSS_TEST__.look(0,0));const start=await snap();await page.keyboard.down('KeyW');await page.waitForFunction(z=>__STAR_ABYSS_TEST__.snapshot().player.z<z-.6,start.player.z);await page.keyboard.up('KeyW');s=await snap();report.crawl=s.avatarPose.characterAsset.retarget.proneJoints;await page.screenshot({path:path.join(out,'crawl.png')});
 await page.keyboard.press('KeyZ');await page.waitForFunction(()=>!__STAR_ABYSS_TEST__.snapshot().gait.proneBlend);report.stood=true;
 // Real repair and dismount after looking away, deliberately never tap Alt.
 await page.evaluate(()=>{__STAR_ABYSS_TEST__.place({x:98,z:64.6,yaw:0});__STAR_ABYSS_TEST__.face(98,62);});await page.keyboard.press('KeyF');
 await page.evaluate(()=>{__STAR_ABYSS_TEST__.place({x:74.6,z:80,yaw:0});__STAR_ABYSS_TEST__.face(72,80);});await page.keyboard.press('KeyF');await page.keyboard.press('KeyF');assert.equal((await snap()).mobility.vehicle.mounted,true);
 await page.mouse.move(1150,450,{steps:3});const driver=await snap();assert.ok(Math.abs(driver.player.yaw-driver.mobility.vehicle.yaw)>.3);
 await page.keyboard.press('KeyF');s=await snap();assert.equal(s.mobility.vehicle.mounted,false);assert.ok(Math.abs(s.player.yaw-s.player.heading)<1e-6);assert.equal(s.lookControl.free,false);assert.equal(s.lookControl.returning,false);
 const before=await snap();await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');await page.mouse.move(650,430,{steps:3});await page.waitForFunction(t=>__STAR_ABYSS_TEST__.snapshot().elapsed>t+.4,before.elapsed);s=await snap();await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');
 assert.ok(Math.abs(s.player.heading-before.player.heading)>.15);assert.ok(Math.abs(s.player.yaw-s.player.heading)<1e-6);assert.ok(Math.hypot(s.player.x-before.player.x,s.player.z-before.player.z)>.5);report.dismountNoAltSteering=true;
 assert.deepEqual(errors,[]);report.errors=errors;report.status='passed';fs.writeFileSync(path.join(out,'browser-audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
