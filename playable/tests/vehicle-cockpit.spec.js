const {test,expect}=require('@playwright/test'),path=require('node:path');
test('legacy view preference, driver V toggle, real dashboard and foot view survive save and dismount',async({page})=>{
 test.setTimeout(100000);await page.setViewportSize({width:1440,height:900});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file:///'+path.resolve(__dirname,'..','star-abyss.html').replace(/\\/g,'/')+'?test=1');await page.locator('#start-button').click();
 const snap=()=>page.evaluate(()=>__STAR_ABYSS_TEST__.snapshot());
 await page.keyboard.press('KeyV');
 await page.evaluate(()=>{__STAR_ABYSS_TEST__.place({x:98,z:64.6,yaw:0});__STAR_ABYSS_TEST__.face(98,62);});await page.keyboard.press('KeyF');expect((await snap()).mobility.vehicle.coupler).toBe(true);
 await page.evaluate(()=>{__STAR_ABYSS_TEST__.place({x:74.6,z:80,yaw:0});__STAR_ABYSS_TEST__.face(72,80);});await page.keyboard.press('KeyF');await page.keyboard.press('KeyF');
 await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().cameraRig.mode==='vehicle');
 await page.keyboard.press('KeyV');await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().cameraRig.mode==='vehicle-first');expect((await snap()).cockpit.handsVisible).toBe(false);
 await page.keyboard.down('KeyW');await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().cockpit.speed>4);await page.keyboard.up('KeyW');await page.keyboard.down('Space');await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().cockpit.speed<.1);expect((await snap()).cockpit.braking).toBe(true);await page.keyboard.up('Space');
 const saved=await page.evaluate(()=>__STAR_ABYSS_TEST__.serialize());await page.evaluate(raw=>__STAR_ABYSS_TEST__.restore(raw),saved);await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().cameraRig.mode==='vehicle-first');
 await page.mouse.move(1150,450,{steps:3});
 await page.keyboard.press('KeyF');await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().cameraRig.mode==='third');expect((await snap()).mobility.vehicle.mounted).toBe(false);
 const exited=await snap();expect(exited.player.heading).toBeCloseTo(exited.player.yaw,6);expect(exited.lookControl.free).toBe(false);expect(exited.lookControl.returning).toBe(false);
 await page.keyboard.down('KeyW');await page.mouse.move(650,430,{steps:3});await page.keyboard.up('KeyW');const turned=await snap();expect(Math.abs(turned.player.heading-exited.player.heading)).toBeGreaterThan(.15);expect(turned.player.heading).toBeCloseTo(turned.player.yaw,6);
 const old=JSON.parse(saved);delete old.vehicleCameraMode;await page.evaluate(raw=>__STAR_ABYSS_TEST__.restore(raw),JSON.stringify(old));await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().cameraRig.mode==='vehicle');
 expect(errors).toEqual([]);
});
