const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/first-person-20260912');fs.mkdirSync(out,{recursive:true});
const gap=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
(async()=>{
 const browser=await chromium.launch({headless:true});const errors=[],report={};
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file:///'+path.join(root,'playable/star-abyss.html').replace(/\\/g,'/')+'?test=1');await page.locator('#start-button').click();
  await page.waitForFunction(()=>{const s=__STAR_ABYSS_TEST__.snapshot();return s.locked&&s.equipmentModel.status==='ready'&&s.avatarPose.characterAsset.status==='ready';});
  const snap=()=>page.evaluate(()=>__STAR_ABYSS_TEST__.snapshot());
  const idle=await snap();assert.equal(idle.cameraMode,'first');assert.equal(idle.equipmentModel.visible,false);
  await page.screenshot({path:path.join(out,'01-empty-hands.png')});report.model=idle.equipmentModel;
  await page.mouse.move(1050,330,{steps:4});
  await page.waitForFunction(y=>Math.abs(__STAR_ABYSS_TEST__.snapshot().player.yaw-y)>.15,idle.player.yaw);
  let s=await snap();assert.ok(Math.abs(s.player.pitch-idle.player.pitch)>.1);
  const expected=[-Math.sin(s.player.yaw)*Math.cos(s.player.pitch),Math.sin(s.player.pitch),-Math.cos(s.player.yaw)*Math.cos(s.player.pitch)];
  assert.ok(s.cameraDirection.every((v,i)=>Math.abs(v-expected[i])<1e-6),'Rendered first-person ray must follow mouse yaw AND pitch');report.firstPersonRay=s.cameraDirection;
  await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');const run=await snap();await page.mouse.move(650,450,{steps:3});
  await page.waitForFunction(t=>__STAR_ABYSS_TEST__.snapshot().elapsed>t+.5,run.elapsed);s=await snap();assert.ok(Math.abs(gap(s.player.heading,run.player.heading))>.15);assert.ok(Math.hypot(s.player.x-run.player.x,s.player.z-run.player.z)>1);report.runSteering=true;
  await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');
  await page.keyboard.down('AltLeft');const facing=await snap();await page.mouse.move(980,340,{steps:3});s=await snap();assert.ok(Math.abs(gap(s.player.yaw,s.player.heading))>.15);assert.ok(Math.abs(gap(s.player.heading,facing.player.heading))<1e-7);
  await page.keyboard.up('AltLeft');await page.waitForFunction(()=>!__STAR_ABYSS_TEST__.snapshot().lookControl.returning);report.altReturn=true;
  await page.keyboard.down('ControlLeft');await page.keyboard.press('KeyZ');await page.keyboard.up('ControlLeft');
  await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().player.eyeHeight<.39);s=await snap();assert.equal(s.player.posture,'prone');assert.ok(s.camera[1]-s.player.y<.4);report.ctrlZProne=true;
  await page.keyboard.press('KeyZ');await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().player.eyeHeight>1.71);
  await page.keyboard.down('Space');await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().mobility.flight.airborne&&__STAR_ABYSS_TEST__.snapshot().mobilityStatus.altitude>1.5);s=await snap();report.flightAltitude=s.mobilityStatus.altitude;assert.ok(s.mobility.flight.energy<100);await page.keyboard.up('Space');
  await page.waitForFunction(()=>!__STAR_ABYSS_TEST__.snapshot().mobility.flight.airborne);report.flightLanded=true;
  await page.evaluate(()=>{__STAR_ABYSS_TEST__.look(0,0);__STAR_ABYSS_TEST__.captureEquipmentPhase('drawing');});
  await page.keyboard.press('KeyQ');await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().frameFrozen);s=await snap();assert.equal(s.equipment.phase,'drawing');
  report.stages=[];
  for(const phase of ['using','folding','stowing','hidden']){
   await page.evaluate(p=>__STAR_ABYSS_TEST__.captureEquipmentPhase(p),phase);await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().frameFrozen);
   s=await snap();assert.equal(s.equipment.phase,phase);report.stages.push({phase,equipment:s.equipment,model:s.equipmentModel,scan:s.scanEffect});
   if(phase==='using'){assert.ok(s.equipmentModel.visible);assert.ok(s.scanEffect.active);}
   if(phase==='hidden')assert.equal(s.equipmentModel.visible,false);
   await page.screenshot({path:path.join(out,'scanner-'+phase+'.png')});
  }
  await page.evaluate(()=>__STAR_ABYSS_TEST__.freezeFrame(false));
  // Actual key event, deterministic simulation sampling for the short jump.
  await page.evaluate(()=>{__STAR_ABYSS_TEST__.place({x:0,z:170,yaw:0});__STAR_ABYSS_TEST__.freezeFrame(true);});await page.keyboard.down('Space');
  await page.evaluate(()=>__STAR_ABYSS_TEST__.advance(.1,__STAR_ABYSS_TEST__.snapshot().controls));await page.keyboard.up('Space');
  report.tapJump=await page.evaluate(()=>{const api=__STAR_ABYSS_TEST__;let max=0;for(let i=0;i<120;i++){api.advance(1/60,api.snapshot().controls);max=Math.max(max,api.snapshot().player.y);}const s=api.snapshot();return {max,airborne:s.mobility.jump.airborne,energy:s.mobility.flight.energy,flight:s.mobility.flight.airborne};});
  assert.ok(report.tapJump.max>.7&&report.tapJump.max<.9);assert.equal(report.tapJump.flight,false);assert.equal(report.tapJump.airborne,false);
  await page.evaluate(()=>{__STAR_ABYSS_TEST__.place({x:12,z:-327.4,yaw:0});__STAR_ABYSS_TEST__.freezeFrame(false);});await page.keyboard.press('KeyF');assert.equal((await snap()).story.flags.signal,true);
  await page.evaluate(()=>{__STAR_ABYSS_TEST__.place({x:0,z:170,yaw:0});__STAR_ABYSS_TEST__.freezeFrame(true);});await page.keyboard.press('KeyE');s=await snap();assert.equal(s.dash.serial,1);assert.equal(s.dash.active,true);
  await page.evaluate(()=>__STAR_ABYSS_TEST__.advance(.5));s=await snap();assert.ok(s.dash.distance>3.9);report.eDashDistance=s.dash.distance;
  await page.evaluate(()=>__STAR_ABYSS_TEST__.freezeFrame(false));
  const memory=(await snap()).graphicsMemory;
  for(let i=0;i<3;i++){
   await page.evaluate(()=>__STAR_ABYSS_TEST__.advance(8));await page.keyboard.press('KeyQ');await page.evaluate(()=>__STAR_ABYSS_TEST__.advance(3));
  }await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().equipment.phase==='hidden');s=await snap();assert.deepEqual(s.graphicsMemory,memory);report.repeatMemoryStable=true;
  for(const width of [1440,768,640]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  // A second real page exercises the embedded-browser fallback without lock.
  await page.close();const fallback=await browser.newPage({viewport:{width:1440,height:900}});fallback.on('pageerror',e=>errors.push(e.message));
  await fallback.addInitScript(()=>{HTMLCanvasElement.prototype.requestPointerLock=undefined;});
  await fallback.goto('file:///'+path.join(root,'playable/star-abyss.html').replace(/\\/g,'/')+'?test=1');await fallback.locator('#start-button').click();
  await fallback.mouse.move(720,450);await fallback.mouse.down();await fallback.mouse.move(850,380,{steps:3});await fallback.mouse.up();
  const dragged=await fallback.evaluate(()=>__STAR_ABYSS_TEST__.snapshot());assert.equal(dragged.cameraMode,'first');assert.equal(dragged.locked,false);assert.ok(Math.abs(dragged.player.yaw)>.1);assert.ok(Math.abs(dragged.player.pitch)>.1);report.firstPersonDragFallback=true;
  assert.deepEqual(errors,[]);report.errors=errors;report.status='passed';fs.writeFileSync(path.join(out,'browser-audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
