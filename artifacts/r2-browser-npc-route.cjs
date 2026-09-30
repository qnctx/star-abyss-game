const fs=require('fs'),path=require('path'),crypto=require('crypto'),{chromium}=require('@playwright/test');
const out=path.resolve('artifacts/r2-browser-npc-route-final');fs.mkdirSync(out,{recursive:true});
(async()=>{let browser;const report={routes:[],errors:[]};try{
 browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>report.errors.push(e.message));
 const bundle=new Promise(resolve=>page.on('response',async r=>{if(new URL(r.url()).pathname.endsWith('/game.js'))resolve(crypto.createHash('sha256').update(await r.body()).digest('hex'));}));
 await page.goto('http://127.0.0.1:4180/star-abyss.html?testLab=1&test=1&expeditionDebug=1');report.bundleSHA=await bundle;
 await page.waitForFunction(()=>{const s=window.__ORIGINAL_EXPEDITION__?.snapshot();return s?.campScene?.status==='ready'&&s.progressionScene?.states?.N04?.status==='ready';},null,{timeout:120000});
 const live=()=>page.evaluate(()=>{const s=window.__ORIGINAL_EXPEDITION__.snapshot(),t=window.__STAR_ABYSS_TEST__.snapshot();return {player:t.player,mobility:t.mobility,near:s.view?.nearby,physician:s.campScene.physician,n04:s.progressionScene.npcs.N04.position,screen:s.screen,menu:s.menu,error:s.error};});
 const routes=[
  {id:'N02-east-diagonal',x:6.4,z:180.8,yaw:Math.PI/8},
  {id:'N02-west-diagonal',x:2.6,z:180.8,yaw:-Math.PI/8},
  {id:'N02-door-east',x:5.5,z:180.9,yaw:0},
  {id:'N02-door',x:4.5,z:181.2,yaw:0},
  {id:'N04-north',x:26,z:176,yaw:Math.PI},
  {id:'N04-northeast',x:29,z:178,yaw:3*Math.PI/4},
  {id:'N04-east',x:31,z:181,yaw:Math.PI/2},
  {id:'N04-southeast',x:29,z:184,yaw:Math.PI/4},
 ];
 for(const route of routes){const targetId=route.id.slice(0,3),selector=targetId==='N02'?'.camp-dialog:not([hidden])':'.quest-panel:not([hidden])';
  await page.evaluate(p=>window.__STAR_ABYSS_TEST__.place(p),{x:route.x,z:route.z,yaw:route.yaw,pitch:0});const placed=await live();const placeError=Math.hypot(placed.player.x-route.x,placed.player.z-route.z);
  const result={...route,placeError,placed:placed.player,points:[],opened:false};report.routes.push(result);
  if(placeError>.2)continue;
  await page.locator('#world').click({position:{x:720,y:410}});await page.keyboard.down('ControlLeft');await page.keyboard.down('KeyW');
  try{for(let i=0;i<90;i++){await page.waitForTimeout(120);const s=await live(),npc=targetId==='N02'?s.physician:s.n04,distance=Math.hypot(s.player.x-npc.x,s.player.z-npc.z);result.points.push({x:s.player.x,y:s.player.y,z:s.player.z,heading:s.player.heading,distance,airborne:s.mobility.flight.airborne||s.mobility.jump.airborne,mounted:s.mobility.vehicle.mounted});if(distance<3.12)break;if(result.points.length>20&&distance>Math.min(...result.points.map(p=>p.distance))+1.2)break;}}
  finally{await page.keyboard.up('KeyW');await page.keyboard.up('ControlLeft');}
  const at=await live();result.after=at;result.minDistance=Math.min(...result.points.map(p=>p.distance));
  if(result.minDistance<3.2)for(let i=0;i<3;i++){await page.keyboard.press('KeyF');await page.waitForTimeout(130);if(await page.locator(selector).isVisible()){result.opened=true;break;}}
  if(result.opened){await page.screenshot({path:path.join(out,route.id+'.png')});await page.locator(targetId==='N02'?selector+' [data-close]':selector+' [data-act="close"]').click();}
  console.log(JSON.stringify({id:route.id,placeError,opened:result.opened,minDistance:result.minDistance,end:result.points.at(-1)}));
 }
 report.complete=true;
 }catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser?.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({complete:report.complete,failure:report.failure,bundleSHA:report.bundleSHA}));}})();
