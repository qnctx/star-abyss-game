const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/look-control-20260912');fs.mkdirSync(out,{recursive:true});
const gap=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
(async()=>{
 const browser=await chromium.launch({headless:true});const errors=[];
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file:///'+path.join(root,'playable/star-abyss.html').replace(/\\/g,'/')+'?test=1');
  await page.locator('#start-button').click();
  await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().locked&&__STAR_ABYSS_TEST__.snapshot().avatarPose.characterAsset.status==='ready');
  await page.keyboard.press('KeyV');
  const snap=()=>page.evaluate(()=>__STAR_ABYSS_TEST__.snapshot());
  const start=await snap();await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');
  await page.waitForFunction(z=>__STAR_ABYSS_TEST__.snapshot().player.z<z-1,start.player.z);
  const before=await snap();await page.mouse.move(1040,460,{steps:5});
  const steered=await snap();assert.ok(Math.abs(gap(steered.player.heading,before.player.heading))>.15,'Mouse must turn body while sprinting');
  assert.ok(Math.abs(gap(steered.player.yaw,steered.player.heading))<.001);
  await page.waitForFunction(x=>Math.abs(__STAR_ABYSS_TEST__.snapshot().player.x-x)>1,steered.player.x);
  const changedRoute=await snap();assert.ok(changedRoute.stamina.sprinting);
  await page.keyboard.down('AltLeft');const held=await snap();
  await page.mouse.move(430,340,{steps:5});const viewed=await snap();
  assert.ok(viewed.freeLook);assert.ok(Math.abs(gap(viewed.player.heading,held.player.heading))<1e-10);
  assert.ok(Math.abs(gap(viewed.player.yaw,viewed.player.heading))>.3);assert.ok(viewed.controls.forward&&viewed.controls.sprint);
  await page.screenshot({path:path.join(out,'alt-free-look.png')});
  await page.keyboard.up('AltLeft');const released=await snap();
  assert.ok(Math.abs(gap(released.player.heading,held.player.heading))<1e-10);
  assert.ok(released.lookControl.returning,'Return must animate, not snap');
  await page.waitForFunction(()=>!__STAR_ABYSS_TEST__.snapshot().lookControl.returning);
  const returned=await snap();assert.ok(Math.abs(gap(returned.player.yaw,returned.player.heading))<.001);assert.ok(Math.abs(gap(returned.player.heading,held.player.heading))<1e-10);
  await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');
  await page.keyboard.down('KeyA');const sideStart=await snap();
  await page.waitForFunction(t=>__STAR_ABYSS_TEST__.snapshot().elapsed>t+.4,sideStart.elapsed);
  const sideEnd=await snap();await page.keyboard.up('KeyA');assert.ok(Math.abs(gap(sideEnd.player.heading,sideStart.player.heading))<1e-10);
  const sideDistance=(sideEnd.player.x-sideStart.player.x)*Math.cos(sideStart.player.heading)-(sideEnd.player.z-sideStart.player.z)*Math.sin(sideStart.player.heading);
  assert.ok(sideDistance<-.3,'A must move laterally without rotating');
  await page.screenshot({path:path.join(out,'returned-third-person.png')});
  const layouts=[];
  for(const width of [1440,768,640]){
   await page.setViewportSize({width,height:900});
   layouts.push(await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,clipped:['body-heading','location-name','movement-help'].filter(id=>{const e=document.getElementById(id);return e&&e.getBoundingClientRect().width>0&&e.scrollWidth>e.clientWidth+1;})})));
  }
  assert.ok(layouts.every(x=>!x.overflow&&!x.clipped.length),JSON.stringify(layouts));
  await page.keyboard.down('AltLeft');await page.keyboard.down('KeyW');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  const paused=await snap();assert.equal(paused.freeLook,false);assert.equal(paused.controls.forward,false);assert.notEqual(paused.screen,'playing');
  await page.keyboard.up('AltLeft');await page.keyboard.up('KeyW');
  await page.locator('#resume-button').click();
  await page.waitForFunction(()=>{const s=__STAR_ABYSS_TEST__.snapshot();return s.screen==='playing'&&s.locked&&!s.lookControl.returning;});
  const resumed=await snap();assert.equal(resumed.freeLook,false);assert.equal(resumed.controls.forward,false);assert.equal(resumed.controls.sprint,false);
  await page.mouse.move(350,400,{steps:3});const afterResume=await snap();
  assert.ok(Math.abs(gap(afterResume.player.heading,resumed.player.heading))>.05,'Mouse steering must work after resume');
  assert.deepEqual(errors,[]);
  const report={status:'passed',mouseSteering:gap(steered.player.heading,before.player.heading),sprintRouteDeltaX:changedRoute.player.x-steered.player.x,freeLookOffset:gap(viewed.player.yaw,viewed.player.heading),releaseHeadingError:gap(returned.player.heading,held.player.heading),sideDistance,blurCleared:true,resumeSteering:true,layouts,errors};
  fs.writeFileSync(path.join(out,'browser-audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
