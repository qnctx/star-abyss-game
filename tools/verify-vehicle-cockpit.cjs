const {chromium}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/vehicle-cockpit-20260912');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true});const errors=[],report={};try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file:///'+path.join(root,'playable/star-abyss.html').replace(/\\/g,'/')+'?test=1');await page.locator('#start-button').click();
 await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().locked&&__STAR_ABYSS_TEST__.snapshot().avatarPose.characterAsset.status==='ready');
 const snap=()=>page.evaluate(()=>__STAR_ABYSS_TEST__.snapshot());
 await page.evaluate(()=>{__STAR_ABYSS_TEST__.place({x:98,z:64.6,yaw:0});__STAR_ABYSS_TEST__.face(98,62);});await page.keyboard.press('KeyF');assert.ok((await snap()).mobility.vehicle.coupler);
 await page.evaluate(()=>{__STAR_ABYSS_TEST__.place({x:74.6,z:80,yaw:0});__STAR_ABYSS_TEST__.face(72,80);});await page.keyboard.press('KeyF');assert.ok((await snap()).mobility.vehicle.repaired);
 await page.keyboard.press('KeyF');await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().cameraRig.mode==='vehicle-first');
 let s=await snap();assert.equal(s.cockpit.handsVisible,false);assert.equal(s.cameraRig.avatarVisible,true);assert.equal(s.equipmentModel.visible,false);report.seated=s.cameraRig;
 await page.screenshot({path:path.join(out,'cockpit-first-person.png')});
 const before=await snap();await page.mouse.move(920,510,{steps:3});const looked=await snap();assert.equal(looked.mobility.vehicle.yaw,before.mobility.vehicle.yaw);assert.ok(Math.abs(looked.player.yaw-before.player.yaw)>.1);assert.deepEqual(looked.camera,before.camera);report.mouseLooksWithoutSteering=true;
 await page.keyboard.down('AltLeft');await page.mouse.move(720,450,{steps:3});await page.keyboard.up('AltLeft');await page.waitForFunction(()=>!__STAR_ABYSS_TEST__.snapshot().lookControl.returning);
 s=await snap();assert.ok(Math.abs(s.player.yaw-s.mobility.vehicle.yaw)<.001);
 await page.keyboard.down('KeyW');await page.keyboard.down('KeyA');await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().mobilityStatus.speed>5);s=await snap();assert.ok(s.cockpit.speed>4);assert.ok(s.cockpit.steering>.05);assert.ok(s.mobility.vehicle.yaw>0);assert.ok(Math.abs(s.player.yaw-s.mobility.vehicle.yaw)<.01);assert.ok(s.cockpit.battery<100);report.movingDashboard=s.cockpit;
 await page.keyboard.up('KeyW');await page.keyboard.up('KeyA');await page.keyboard.down('Space');await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().mobilityStatus.speed<.1);s=await snap();assert.equal(s.cockpit.braking,true);await page.keyboard.up('Space');
 await page.keyboard.press('KeyV');await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().cameraRig.mode==='vehicle');s=await snap();assert.equal(s.cockpit.handsVisible,false);assert.equal(s.cameraRig.avatarVisible,true);assert.equal(s.cameraMode,'first');
 await page.screenshot({path:path.join(out,'same-vehicle-exterior.png')});
 const saved=await page.evaluate(()=>__STAR_ABYSS_TEST__.serialize());await page.evaluate(raw=>__STAR_ABYSS_TEST__.restore(raw),saved);await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().cameraRig.mode==='vehicle');report.savedDriverView=true;
 await page.keyboard.press('KeyF');await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().cameraRig.mode==='first');assert.equal((await snap()).mobility.vehicle.mounted,false);report.restoredFootView=true;
 const vehicle=(await snap()).mobility.vehicle;await page.evaluate(v=>__STAR_ABYSS_TEST__.face(v.x,v.z),vehicle);await page.keyboard.press('KeyF');await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().cameraRig.mode==='vehicle');
 await page.keyboard.press('KeyV');await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().cameraRig.mode==='vehicle-first');
 report.layouts=[];for(const width of [1440,768,640]){await page.setViewportSize({width,height:900});const layout=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,clipped:[...document.querySelectorAll('.hud-controls button,.suit-status p')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.id)}));report.layouts.push(layout);assert.equal(layout.overflow,false);assert.deepEqual(layout.clipped,[]);}
 await page.screenshot({path:path.join(out,'cockpit-640.png')});assert.deepEqual(errors,[]);report.errors=errors;report.status='passed';fs.writeFileSync(path.join(out,'browser-audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
