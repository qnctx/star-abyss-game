const { test, expect } = require('@playwright/test');
const path = require('node:path');
const url = 'file:///' + path.resolve(__dirname, '..', 'star-abyss.html').replace(/\\/g, '/') + '?test=1';
test.use({ viewport: { width: 1440, height: 900 } });
test.beforeEach(async ({ page }) => { await page.goto(url); await page.locator('#start-button').click(); });
const snapshot = page => page.evaluate(() => __STAR_ABYSS_TEST__.snapshot());

test('desktop posture, scanner, jump, automatic movement and map use real keys',async({page})=>{
 test.setTimeout(120000);
 await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().avatarPose.characterAsset.status==='ready');
 await page.keyboard.press('KeyV');await page.keyboard.press('KeyC');
 await page.waitForFunction(()=>{const s=__STAR_ABYSS_TEST__.snapshot();return s.player.eyeHeight<1.06&&s.avatarPose.pelvis.position[1]<.6;});
 await page.keyboard.press('KeyZ');await page.waitForFunction(()=>{const s=__STAR_ABYSS_TEST__.snapshot();return s.player.eyeHeight<.39&&s.cameraRig.avatarVisible&&s.gait.proneBlend>.99;});
 const before=await snapshot(page);await page.keyboard.down('KeyW');
 await page.waitForFunction(z=>__STAR_ABYSS_TEST__.snapshot().player.z<z-.25,before.player.z);await page.keyboard.up('KeyW');
 await page.keyboard.press('KeyZ');await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().player.eyeHeight>1.71);
 await page.keyboard.down('ControlLeft');await page.keyboard.down('AltLeft');await page.keyboard.down('KeyW');
 expect((await snapshot(page)).freeLook).toBe(true);expect((await snapshot(page)).controls.walk).toBe(true);
 await page.keyboard.up('AltLeft');await page.keyboard.up('ControlLeft');await page.keyboard.up('KeyW');
 await page.keyboard.press('KeyQ');expect((await snapshot(page)).scannerCooldown).toBeGreaterThan(0);
 // Subscribe before the actual key event. Trace collection can delay the next
 // protocol call until after a short jump has already landed.
 await page.evaluate(()=>{
   const api=__STAR_ABYSS_TEST__,base=api.snapshot().player.y;
   window.jumpAudit={takeoff:false,landed:false,maxHeight:0};
   function sample(){const s=api.snapshot(),a=window.jumpAudit;
     if(s.mobility.jump.airborne){a.takeoff=true;a.maxHeight=Math.max(a.maxHeight,s.player.y-base);}
     else if(a.takeoff){a.landed=true;a.energy=s.mobility.flight.energy;return;}
     requestAnimationFrame(sample);
   }requestAnimationFrame(sample);
 });
 await page.keyboard.press('Space');await page.waitForFunction(()=>window.jumpAudit.landed);
 const jump=await page.evaluate(()=>window.jumpAudit);expect(jump.maxHeight).toBeGreaterThan(.7);expect(jump.maxHeight).toBeLessThan(.9);expect(jump.energy).toBe(100);
 await page.keyboard.press('Equal');expect((await snapshot(page)).controls.autoRun).toBe(true);
 await page.keyboard.press('KeyM');expect((await snapshot(page)).screen).toBe('journal');expect((await snapshot(page)).controls.autoRun).toBe(false);
 await page.keyboard.press('KeyM');await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().locked);
 await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().scannerCooldown===0);
 await page.keyboard.press('KeyQ');expect((await snapshot(page)).scannerCooldown).toBeGreaterThan(0);
});
