const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),{chromium}=require('@playwright/test');
const out=path.resolve(process.env.R2_OUT||'artifacts/r2-integrated-browser');fs.mkdirSync(out,{recursive:true});
const url='http://127.0.0.1:4180/star-abyss.html?testLab=1&test=1&expeditionDebug=1';
(async()=>{
 let browser;const report={url,checks:[],errors:[],assets:[],complete:false};
 try{
  browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const bundle=new Promise(resolve=>page.on('response',async r=>{if(new URL(r.url()).pathname.endsWith('/game.js')){try{resolve(crypto.createHash('sha256').update(await r.body()).digest('hex'));}catch(e){resolve('ERROR: '+e.message);}}}));
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('response',r=>{if(r.url().endsWith('.glb'))report.assets.push({url:r.url(),status:r.status()});});
  page.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/favicon.ico'))report.errors.push(m.text());});
  await page.goto(url);report.bundleSHA=await bundle;
  await page.waitForFunction(()=>{const s=window.__ORIGINAL_EXPEDITION__?.snapshot();return window.__STAR_ABYSS_LAB__?.snapshot().lab.ready&&s?.campV2?.status==='ready'&&s.campScene?.status==='ready'&&['N01','N03','N04','N05'].every(id=>s.progressionScene.states[id]?.status==='ready');},null,{timeout:120000});
  const snapshot=()=>page.evaluate(()=>window.__ORIGINAL_EXPEDITION__.snapshot());
  const positions=s=>({...Object.fromEntries(Object.entries(s.progressionScene.npcs).map(([id,n])=>[id,n.position])),N02:s.campScene.physician});
  async function place(x,z,yaw=0){await page.evaluate(p=>window.__STAR_ABYSS_TEST__.place(p),{x,z,yaw,pitch:0});const before=await page.evaluate(()=>window.__STAR_ABYSS_TEST__.snapshot().player);assert(Math.hypot(before.x-x,before.z-z)<.2,'Test placement rejected by collision');await page.locator('#world').click({position:{x:720,y:410}});const afterClick=await page.evaluate(()=>window.__STAR_ABYSS_TEST__.snapshot().player);await page.evaluate(p=>window.__STAR_ABYSS_TEST__.face(p.x-Math.sin(p.yaw)*50,p.z-Math.cos(p.yaw)*50),{x,z,yaw});const afterFace=await page.evaluate(()=>window.__STAR_ABYSS_TEST__.snapshot().player);report.checks.push({name:'place',request:{x,z,yaw},before:{x:before.x,z:before.z,heading:before.heading,yaw:before.yaw},afterClick:{x:afterClick.x,z:afterClick.z,heading:afterClick.heading,yaw:afterClick.yaw},afterFace:{x:afterFace.x,z:afterFace.z,heading:afterFace.heading,yaw:afterFace.yaw}});await page.waitForTimeout(350);}
  await place(0,211);const initial=await snapshot(),samples=[];for(let i=0;i<7;i++){await page.waitForTimeout(2600);samples.push(await snapshot());}
  const first=positions(initial),moved=positions(samples.at(-1));
  const distances=Object.fromEntries(Object.keys(first).map(id=>[id,Math.max(...samples.map(s=>{const p=positions(s)[id];return Math.hypot(p.x-first[id].x,p.z-first[id].z)}))]));
  const legMotion=Object.fromEntries(['N01','N03','N04','N05'].map(id=>{const states=samples.map(s=>s.progressionScene.npcs[id]);return [id,{maxMove:Math.max(...states.map(s=>s.move)),thighRange:Math.max(...states.map(s=>s.bones[6].rotation[0]))-Math.min(...states.map(s=>s.bones[6].rotation[0]))}]}));
  report.checks.push({name:'actual-npc-activity',initial:first,moved,distances,legMotion});
  assert(Object.values(distances).every(d=>d>.05),'An actor never changed actual position');
  assert(Object.values(legMotion).every(v=>v.maxMove>.1&&v.thighRange>.005),'An NPC had no visible leg drive');
  await page.screenshot({path:path.join(out,'camp-overview.png')});
  // Walk onto a real raised entrance before testing F interaction.
  await place(-17,181);const platform=[];await page.keyboard.down('ControlLeft');await page.keyboard.down('KeyW');
  try{for(let i=0;i<110;i++){await page.waitForTimeout(120);const pose=await page.evaluate(()=>window.__STAR_ABYSS_TEST__.snapshot().player);platform.push({x:pose.x,y:pose.y,z:pose.z,blocked:pose.blocked});if(pose.z<176.5)break;}}
  finally{await page.keyboard.up('KeyW');await page.keyboard.up('ControlLeft');}
  report.checks.push({name:'physical-platform-entry',start:platform[0],end:platform.at(-1),maxY:Math.max(...platform.map(p=>p.y)),minZ:Math.min(...platform.map(p=>p.z)),path:platform});
  await page.screenshot({path:path.join(out,'platform-entry.png')});
  for(const id of ['N01','N02','N03','N04','N05']){
   const p=positions(await snapshot())[id];if(id==='N05'||id==='N04')await place(p.x+5,p.z,Math.PI/2);else if(id==='N02')await place(4,180);else await place(p.x,p.z+5);
   const approach=[];await page.keyboard.down('ControlLeft');await page.keyboard.down('KeyW');
   try{for(let i=0;i<110;i++){await page.waitForTimeout(120);const s=await snapshot(),a=positions(s)[id],pose=await page.evaluate(()=>window.__STAR_ABYSS_TEST__.snapshot().player),distance=Math.hypot(pose.x-a.x,pose.z-a.z);approach.push({x:pose.x,y:pose.y,z:pose.z,distance});if(distance<3.08)break;if(approach.length>20&&distance>Math.min(...approach.map(p=>p.distance))+1.5)break;}}
   finally{await page.keyboard.up('KeyW');await page.keyboard.up('ControlLeft');}
   const pose=await page.evaluate(()=>window.__STAR_ABYSS_TEST__.snapshot().player),distance=approach.at(-1).distance;
   const sel=id==='N02'?'.camp-dialog:not([hidden])':'.quest-panel:not([hidden])';let opened=false;
   if(distance<3.2)for(let i=0;i<8;i++){const current=positions(await snapshot())[id];await page.evaluate(p=>window.__STAR_ABYSS_TEST__.face(p.x,p.z),current);await page.keyboard.press('KeyF');await page.waitForTimeout(180);if(await page.locator(sel).isVisible()){opened=true;break;}}
   const check={name:'walk-and-interact-'+id,pose,distance,approach,opened,npc:positions(await snapshot())[id]};report.checks.push(check);
   await page.screenshot({path:path.join(out,id+(opened?'-dialog':'-failed')+'.png')});
   if(!opened)continue;
   const a=positions(await snapshot())[id];await page.waitForTimeout(1200);const b=positions(await snapshot())[id];check.talkingMovement=Math.hypot(b.x-a.x,b.z-a.z);
   if(id==='N01'){const accept=page.locator('[data-act="accept:Q01"]');check.Q01Button={visible:await accept.isVisible(),enabled:await accept.isEnabled()};if(check.Q01Button.visible&&check.Q01Button.enabled){await accept.click();await page.waitForFunction(()=>window.__ORIGINAL_EXPEDITION__.snapshot().root?.camp?.progression?.quests?.Q01?.status==='active',null,{timeout:15000});check.Q01Accepted=true;check.Q01Revision=(await snapshot()).root.revision;}}
   await page.locator(id==='N02'?sel+' [data-close]':sel+' [data-act="close"]').click();
  }
  const last=await snapshot();report.rootWorld=last.root.worldId;
  assert(last.root.worldId.startsWith('test-lab:'));assert.deepEqual(report.errors,[]);
  for(const file of ['command.glb','medical.glb','workshop.glb'])assert(report.assets.some(a=>a.url.endsWith('/'+file)&&a.status===200));
  assert(report.checks.find(c=>c.name==='physical-platform-entry').maxY>.5,'The player never reached the raised platform');
  assert(['N01','N02','N03','N04','N05'].every(id=>report.checks.find(c=>c.name==='walk-and-interact-'+id)?.opened),'At least one NPC was inaccessible through walking');
  assert(['N01','N02','N03','N04','N05'].every(id=>report.checks.find(c=>c.name==='walk-and-interact-'+id)?.talkingMovement<.001),'An NPC moved during dialog');
  assert(report.checks.find(c=>c.name==='walk-and-interact-N01')?.Q01Accepted,'Q01 was not accepted');report.complete=true;
 }catch(e){report.failure=e.stack;process.exitCode=1;}
 finally{await browser?.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({complete:report.complete,failure:report.failure,bundleSHA:report.bundleSHA,checks:report.checks.map(c=>({name:c.name,opened:c.opened,distance:c.distance,maxY:c.maxY,talkingMovement:c.talkingMovement,Q01Accepted:c.Q01Accepted,distances:c.distances,legMotion:c.legMotion}))},null,2));}
})();
