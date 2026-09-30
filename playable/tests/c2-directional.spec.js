const {test,expect}=require('@playwright/test');
const path=require('node:path');
const esbuild=require('esbuild');
test('C2 rendered idle knees and feet remain stationary through breathing loops',async({page})=>{
 test.setTimeout(60000);
 await page.goto('file:///'+path.resolve(__dirname,'../../docs/ui-implementation/c2-character-preview.html').replace(/\\/g,'/'));
 await page.waitForFunction(()=>window.c2Preview);
 const result=await page.evaluate(()=>{
  c2Preview.reset('idle');const first=c2Preview.snapshot();let drift=0,error=0,breathing=false;
  for(let i=0;i<1200;i++){
   const pose=c2Preview.advance(1,false);
   for(let k=0;k<2;k++){
    for(const joint of ['hip','knee','ankle'])for(let axis=0;axis<3;axis++)drift=Math.max(drift,Math.abs(pose.feet[k].joints[joint][axis]-first.feet[k].joints[joint][axis]));
    for(let axis=0;axis<3;axis++)drift=Math.max(drift,Math.abs(pose.feet[k].actual[axis]-first.feet[k].actual[axis]));
    error=Math.max(error,pose.feet[k].error);
   }
   breathing ||= JSON.stringify(pose.chest)!==JSON.stringify(first.chest);
  }
  c2Preview.render();return{drift,error,breathing};
 });
 console.log('IDLE_STABILITY',JSON.stringify(result));
 expect(result.drift).toBeLessThan(1e-8);expect(result.error).toBeLessThan(.002);expect(result.breathing).toBe(true);
});
test('C2 delivered file preview plays and steps the production rig without a server',async({page})=>{
 test.setTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file:///'+path.resolve(__dirname,'../../docs/ui-implementation/c2-character-preview.html').replace(/\\/g,'/'));
 await page.waitForFunction(()=>window.c2Preview);await page.selectOption('#motion','run');
 const before=await page.evaluate(()=>JSON.stringify(c2Preview.snapshot()));await page.locator('#step').click();
 expect(await page.evaluate(()=>JSON.stringify(c2Preview.snapshot()))).not.toBe(before);
 await page.locator('#play').click();await expect(page.locator('#play')).toHaveText('暂停动作');await page.locator('#play').click();
 for(const width of [1440,640]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
 expect(errors).toEqual([]);
});
test('C2 real input: mouse steers, Alt orbits, A/D sidestep, arrows turn and heading saves',async({page})=>{
 test.setTimeout(120000);await page.setViewportSize({width:1440,height:900});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file:///'+path.resolve(__dirname,'../star-abyss.html').replace(/\\/g,'/')+'?test=1');await page.locator('#start-button').click();
 await page.keyboard.press('KeyV');
 const snapshot=()=>page.evaluate(()=>__STAR_ABYSS_TEST__.snapshot());
 const before=await snapshot();expect(before.rockChunks).toBeGreaterThan(1);expect(before.renderRatio).toBeGreaterThanOrEqual(.65);expect(before.renderRatio).toBeLessThanOrEqual(1.25);await page.keyboard.down('KeyW');
 await page.waitForFunction(z=>__STAR_ABYSS_TEST__.snapshot().player.z<z-.6,before.player.z);
 await page.keyboard.down('AltLeft');await page.mouse.move(1070,460,{steps:6});const looked=await snapshot();
 expect(Math.abs(looked.player.yaw-before.player.yaw)).toBeGreaterThan(.1);expect(looked.player.heading).toBe(before.player.heading);
 await page.waitForFunction(z=>__STAR_ABYSS_TEST__.snapshot().player.z<z-.6,looked.player.z);await page.keyboard.up('KeyW');
 const after=await snapshot();expect(Math.abs(after.player.x-before.player.x)).toBeLessThan(.05);
 await page.keyboard.up('AltLeft');await page.waitForFunction(()=>!__STAR_ABYSS_TEST__.snapshot().lookControl.returning);
 const facing=(await snapshot()).player.heading;await page.mouse.move(850,460,{steps:4});
 expect(Math.abs((await snapshot()).player.heading-facing)).toBeGreaterThan(.1);
 await page.evaluate(()=>__STAR_ABYSS_TEST__.place({x:0,z:180,yaw:1.4,heading:0}));
 for(const [key,sign] of [['KeyA',-1],['KeyD',1]]){
  const start=await snapshot();await page.keyboard.down(key);await page.waitForFunction(({x,sign})=>(__STAR_ABYSS_TEST__.snapshot().player.x-x)*sign>.4,{x:start.player.x,sign});
  const s=await snapshot();await page.keyboard.up(key);expect(s.player.heading).toBe(0);expect(Math.abs(s.gait.facing)).toBeLessThan(.02);expect(s.gait.direction[sign<0?'left':'right']).toBeGreaterThan(.8);
 }
 await page.keyboard.down('ArrowRight');await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().player.heading<-.3);await page.keyboard.up('ArrowRight');
 const turned=await snapshot();expect(turned.player.yaw-turned.player.heading).toBeCloseTo(1.4,2);
 await page.keyboard.press('Tab');
 const mapAngles=await page.locator('#map-player path').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.role,Number(n.getAttribute('transform').match(/rotate\(([^)]+)\)/)[1])])));
 const degrees=value=>((-value*180/Math.PI)%360+360)%360;
 expect(mapAngles['body-heading']).toBeCloseTo(degrees(turned.player.heading),1);expect(mapAngles['look-heading']).toBeCloseTo(degrees(turned.player.yaw),1);
 const saved=await page.evaluate(()=>__STAR_ABYSS_TEST__.serialize());await page.evaluate(s=>__STAR_ABYSS_TEST__.restore(s),saved);
 expect((await snapshot()).player.heading).toBeCloseTo(turned.player.heading,4);
 expect((await snapshot()).screen).toBe('playing');
 await page.screenshot({path:'docs/ui-implementation/c2-independent-game.png'});
 for(const width of [1440,768,640]){
  await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  const clipped=await page.evaluate(()=>['body-heading','location-name'].filter(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth||e.scrollWidth>e.clientWidth+1);}));expect(clipped).toEqual([]);
 }
 expect(errors).toEqual([]);
});
test('C2 same animated 3D mesh from eight angles: relaxed, walk, backward, sidesteps and run',async({page})=>{
 test.setTimeout(120000);await page.setViewportSize({width:1600,height:990});
 await page.setContent('<style>body{margin:0;background:#252a29;color:#d9dfda;font:16px sans-serif}h1{font-size:22px;margin:16px}canvas{display:block}footer{padding:10px}</style><h1>C2 · 同一实际 3D 模型 / 每 45° 环绕检视</h1><canvas></canvas><footer>左至右：正面、前右、右侧、后右 / 背面、后左、左侧、前左。不是概念图。</footer>');
 const bundle=await esbuild.build({entryPoints:[path.resolve(__dirname,'c2-preview.mjs')],bundle:true,format:'iife',write:false});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addScriptTag({content:bundle.outputFiles[0].text});
 for(const mode of ['idle','walk','back','left','right','run']){
  await page.evaluate(mode=>c2Preview.reset(mode),mode);
  const samples=await page.evaluate(()=>{const result=[];for(let i=0;i<36;i++)result.push(c2Preview.advance(2));return result;});
  for(const pose of samples){expect(Math.abs(pose.headingYaw)).toBeLessThan(.01);for(const foot of pose.feet){expect(foot.error).toBeLessThan(.04);expect(foot.reachError).toBeLessThan(.04);}}
  if(mode!=='idle')expect(samples.some(p=>p.feet.some(f=>!f.stance))).toBe(true);
  await page.screenshot({path:`docs/ui-implementation/c2-${mode}-eight-angles.png`});
 }
 expect(errors).toEqual([]);
});
