const {chromium}=require('@playwright/test'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{const server=require('child_process').spawn(process.execPath,['playable/tests/static-server.js'],{env:{...process.env,PORT:'4186'},windowsHide:true});const browser=await chromium.launch({headless:true});try{
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
page.setDefaultTimeout(90000);
const fixture=process.argv[2]||'physicsFixture=vehicle-slope',prefix=fixture.includes('backside')?'remote':fixture.includes('steep')?'steep':'slope';
const shot=name=>page.screenshot({path:`reports/rider-alignment/${prefix}-${name}.png`});
await page.goto('http://127.0.0.1:4186/?test=1&'+fixture);await page.locator('#start-button').click();
await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().avatarPose.characterAsset.status==='ready'&&__STAR_ABYSS_TEST__.snapshot().screen==='playing');
const snap=()=>page.evaluate(()=>__STAR_ABYSS_TEST__.snapshot());
await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().mobility.vehicle.mounted);await page.waitForTimeout(3000);
if((await snap()).cameraRig.mode==='vehicle-first'){await page.evaluate(()=>document.getElementById('camera-button').click());await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().cameraRig.mode==='vehicle');}
await page.waitForTimeout(1500);let s=await snap();await page.evaluate(()=>{const t=__STAR_ABYSS_TEST__,s=t.snapshot();t.look(s.player.yaw+1.2,-.15);});await page.waitForTimeout(250);await shot('third');
await page.evaluate(()=>document.getElementById('camera-button').click());await page.evaluate(()=>{const t=__STAR_ABYSS_TEST__,s=t.snapshot();t.look(s.mobility.vehicle.yaw,-.65);});await page.waitForTimeout(250);s=await snap();assert.equal(s.cameraRig.mode,'vehicle-first');assert.equal(s.cameraRig.avatarVisible,true);assert.equal(s.cockpit.handsVisible,false);await shot('first');
const before=s.camera;await page.evaluate(()=>__STAR_ABYSS_TEST__.look(.7,-.6));await page.waitForTimeout(200);assert.deepEqual((await snap()).camera,before);
await page.keyboard.down('KeyA');await page.waitForTimeout(300);s=await snap();assert.equal(s.cockpit.steering,.22);await shot('turn-first');await page.keyboard.up('KeyA');
assert.equal(s.avatarPose.characterAsset.firstPersonHeadHidden,true);
await page.evaluate(()=>document.getElementById('camera-button').click());await page.waitForTimeout(250);assert.equal((await snap()).avatarPose.characterAsset.firstPersonHeadHidden,false);
await page.keyboard.press('KeyF');await page.waitForTimeout(250);const foot=await snap();assert.equal(foot.mobility.vehicle.mounted,false);assert.equal(foot.avatarPose.characterAsset.firstPersonHeadHidden,false);
if(prefix!=='remote'){
 await page.evaluate(()=>__STAR_ABYSS_TEST__.place({x:0,z:190,yaw:0}));
 if((await snap()).cameraRig.mode!=='first')await page.evaluate(()=>document.getElementById('camera-button').click());
 await page.keyboard.press('KeyZ');await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().avatarPose.characterAsset.firstPersonHeadHidden===true);
 await page.keyboard.press('KeyZ');await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().avatarPose.characterAsset.firstPersonHeadHidden===false);
 await page.keyboard.press('KeyQ');await page.waitForTimeout(200);const equipment=await snap();assert.equal(equipment.avatarPose.characterAsset.firstPersonHeadHidden,false);
}
fs.writeFileSync(`reports/rider-alignment/${prefix}-browser.json`,JSON.stringify({errors,first:s,passed:true},null,2));assert.deepEqual(errors,[]);
}finally{await browser.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
