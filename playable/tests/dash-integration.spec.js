const {test,expect}=require('@playwright/test');const path=require('node:path');
test('earn entry dash by investigating signal, use real E, keep cost/collision/pause/save consistent',async({page})=>{
 test.setTimeout(120000);await page.setViewportSize({width:1440,height:900});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file:///'+path.resolve(__dirname,'..','star-abyss.html').replace(/\\/g,'/')+'?test=1');
 await page.locator('#start-button').click();await page.keyboard.press('KeyE');
 expect((await page.evaluate(()=>__STAR_ABYSS_TEST__.snapshot())).dash.serial).toBe(0);
 // Place only: the actual F interaction earns the signal flag and entry skill.
 await page.evaluate(()=>__STAR_ABYSS_TEST__.place({x:12,z:-327.4,yaw:0}));
 await page.keyboard.press('KeyF');expect((await page.evaluate(()=>__STAR_ABYSS_TEST__.snapshot())).story.flags.signal).toBe(true);
 await page.evaluate(()=>__STAR_ABYSS_TEST__.place({x:0,z:170,yaw:0}));
 await page.keyboard.press('KeyV');await page.evaluate(()=>__STAR_ABYSS_TEST__.captureNextDash());await page.keyboard.press('KeyE');
 const started=await page.evaluate(()=>__STAR_ABYSS_TEST__.snapshot());
 expect(started.dash.serial).toBe(1);expect(started.stamina.value).toBeCloseTo(80,1);
 await page.waitForFunction(()=>{const s=__STAR_ABYSS_TEST__.snapshot();return s.dash.active&&s.dash.distance>.5&&s.dashEffect.visible;});
 await page.screenshot({path:'docs/ui-implementation/dash-entry-world.png'});
 await page.evaluate(()=>__STAR_ABYSS_TEST__.freezeFrame(false));
 await page.waitForFunction(()=>!__STAR_ABYSS_TEST__.snapshot().dash.active);
 const ended=await page.evaluate(()=>__STAR_ABYSS_TEST__.snapshot());expect(ended.player.z).toBeCloseTo(166,3);
 expect(ended.evolution.footDistance).toBeCloseTo(started.evolution.footDistance,2);
 await page.keyboard.press('KeyE');expect((await page.evaluate(()=>__STAR_ABYSS_TEST__.snapshot())).dash.serial).toBe(1);
 await page.keyboard.press('Tab');const paused=await page.evaluate(()=>__STAR_ABYSS_TEST__.snapshot());
 await page.evaluate(()=>__STAR_ABYSS_TEST__.advance(20));expect((await page.evaluate(()=>__STAR_ABYSS_TEST__.snapshot())).dash.cooldown).toBe(paused.dash.cooldown);
 const saved=await page.evaluate(()=>__STAR_ABYSS_TEST__.serialize());await page.evaluate(s=>__STAR_ABYSS_TEST__.restore(s),saved);
 const restored=await page.evaluate(()=>__STAR_ABYSS_TEST__.snapshot());expect(restored.dash.active).toBe(false);expect(restored.dash.cooldown).toBeGreaterThan(0);
 await page.evaluate(()=>{__STAR_ABYSS_TEST__.advance(8);__STAR_ABYSS_TEST__.place({x:0,z:-708,yaw:0});});
 await page.keyboard.press('KeyE');await page.evaluate(()=>__STAR_ABYSS_TEST__.advance(.5));
 const wall=await page.evaluate(()=>__STAR_ABYSS_TEST__.snapshot());expect(wall.player.z).toBeGreaterThan(-710);expect(wall.dash.distance).toBeLessThan(4);
 await page.keyboard.press('KeyU');await expect(page.locator('#dash-skill-status')).toContainText('已解析');
 for(const width of [1440,640]){await page.setViewportSize({width,height:900});await page.locator('#dash-title').scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
 await page.screenshot({path:'docs/ui-implementation/dash-entry-detail-640.png'});
 expect(errors).toEqual([]);
});
