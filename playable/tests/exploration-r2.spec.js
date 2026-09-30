const {test,expect}=require('@playwright/test');
const path=require('node:path');
const url='file:///'+path.resolve(__dirname,'..','star-abyss.html').replace(/\\/g,'/')+'?test=1';
test.use({viewport:{width:1440,height:900}});
test('wreck multi-angle inspection, independent driving camera, and separate map/records shortcuts',async({page})=>{
 test.setTimeout(180000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.locator('#start-button').click();
 const original=JSON.parse(await page.evaluate(()=>__STAR_ABYSS_TEST__.serialize()));
 for(const [name,x,z] of [['front',0,-430],['port',-125,-560],['rear',85,-830]]){
  const raw=structuredClone(original);raw.player={x,z,yaw:Math.atan2(x,z+630),pitch:.12};
  await page.evaluate(s=>__STAR_ABYSS_TEST__.restore(s),JSON.stringify(raw));
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.screenshot({path:`docs/ui-implementation/wreck-r2-${name}.png`});
 }
 // Explicit fixture tests controls without modifying the user's saved game.
 const drive=structuredClone(original);drive.player={x:0,z:180,yaw:0,pitch:0};
 Object.assign(drive.mobility.vehicle,{x:0,z:180,yaw:0,repaired:true,mounted:true});
 await page.evaluate(s=>__STAR_ABYSS_TEST__.restore(s),JSON.stringify(drive));
 await page.keyboard.press('Tab');await page.keyboard.press('Tab');
 await page.waitForFunction(()=>document.pointerLockElement?.id==='world');
 await page.mouse.move(800,450);await page.mouse.move(1100,450);
 const before=await page.evaluate(()=>__STAR_ABYSS_TEST__.snapshot());
 await page.keyboard.down('KeyW');
 await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().mobilityStatus.speed>3);
 await page.keyboard.up('KeyW');
 const after=await page.evaluate(()=>__STAR_ABYSS_TEST__.snapshot());
 expect(after.player.z).toBeLessThan(before.player.z);expect(after.player.x).toBeCloseTo(0,6);
 expect(after.mobility.vehicle.yaw).toBe(0);expect(Math.abs(after.player.yaw)).toBeGreaterThan(.1);
 await page.keyboard.down('KeyG');await page.evaluate(()=>__STAR_ABYSS_TEST__.advance(2,{lift:true}));await page.keyboard.up('KeyG');
 await page.keyboard.press('KeyJ');await expect(page.locator('#records-screen-title')).toContainText('调查记录');
 await page.keyboard.press('KeyJ');await expect(page.locator('#journal-screen')).toBeHidden();
 await page.keyboard.press('Tab');await expect(page.locator('#journal-title')).toHaveText('探索地图');
 await expect(page.locator('#journal-records')).toBeHidden();
 await page.screenshot({path:'docs/ui-implementation/map-r2.png'});
 for(const width of [1440,720]){
  await page.setViewportSize({width,height:900});
  const clipped=await page.locator('#journal-screen button,#journal-title').evaluateAll(elements=>elements.filter(e=>e.getClientRects().length&&e.scrollWidth>e.clientWidth+1).map(e=>e.textContent));
  expect(clipped).toEqual([]);
 }
 await page.keyboard.press('KeyU');await expect(page.locator('#evolution-screen-title')).toContainText('共生进化');
 expect(errors).toEqual([]);
});

test('surface map groups deck details without losing the tracked target or interior access',async({page})=>{
 test.setTimeout(60000);
 await page.goto(url);await page.locator('#start-button').click();
 // Known deck locations are fixture data, not claims of completing the story.
 const raw=JSON.parse(await page.evaluate(()=>__STAR_ABYSS_TEST__.serialize()));
 raw.story.flags.entered=true;raw.story.flags.log=true;
 raw.discovered=['fuse','power','log','relay-1','relay-2','relay-3'];
 await page.evaluate(s=>__STAR_ABYSS_TEST__.restore(s),JSON.stringify(raw));
 await page.keyboard.press('Tab');
 await page.locator('#map-world').click();
 await page.locator('.map-places').evaluate(el => { el.open = true; }); await expect(page.locator('#map-point-list button[data-point-id="log"]')).toHaveCount(0);
 await page.locator('.map-places').evaluate(el => { el.open = true; }); await expect(page.locator('#map-point-list button[data-point-id="relay-1"]')).toHaveCount(0);
 await page.locator('#map-interior').click();
 await page.locator('.map-places').evaluate(el => { el.open = true; }); await expect(page.locator('#map-point-list button[data-point-id="log"]')).toBeVisible();
 await page.locator('.map-places').evaluate(el => { el.open = true; }); await page.locator('#map-point-list button[data-point-id="log"]').click();
 await page.locator('#map-world').click();
 await page.locator('.map-places').evaluate(el => { el.open = true; }); await expect(page.locator('#map-point-list button[data-point-id="log"]')).toBeVisible();
 await page.locator('.map-places').evaluate(el => { el.open = true; }); await expect(page.locator('#map-point-list button[data-point-id="relay-1"]')).toHaveCount(0);
 await page.locator('#map-clear-waypoint').click();
 await page.locator('.map-places').evaluate(el => { el.open = true; }); await expect(page.locator('#map-point-list button[data-point-id="log"]')).toHaveCount(0);
 await page.keyboard.press('KeyJ');await expect(page.locator('#journal-records')).toBeVisible();
 await page.keyboard.press('Tab');await expect(page.locator('#journal-screen')).toBeHidden();
 await page.keyboard.press('Tab');await expect(page.locator('.map-section')).toBeVisible();
 await expect(page.locator('#journal-records')).toBeHidden();
});
