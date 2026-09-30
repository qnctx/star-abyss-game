// Independent R11 real-input acceptance. Run only after the controller freezes 4180.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{chromium}=require('@playwright/test');
const out=path.resolve('artifacts/r11-candidate');fs.mkdirSync(out,{recursive:true});
const cpuPath='artifacts/r11-cpu-validation.json';
const expected=fs.existsSync(cpuPath)?JSON.parse(fs.readFileSync(cpuPath,'utf8')).bundleSHA:process.env.R11_EXPECTED_SHA;
if(!expected)throw Error('R11 freeze SHA missing; set R11_EXPECTED_SHA or create r11-cpu-validation.json');
const assetFile=path.resolve('playable/assets/creatures/riftwing-r11/riftwing-r11.glb');
const expectedAssetSHA=crypto.createHash('sha256').update(fs.readFileSync(assetFile)).digest('hex');
const report={at:new Date().toISOString(),bundleSHA:null,expectedBundleSHA:expected,assetSHA:null,expectedAssetSHA,complete:false,errors:[],gameplayErrors:[],assertions:{},samples:[],visualClips:[],screenshots:[],notes:[],scope:'R4 same-actor ground-air-ground encounter, actual browser keyboard/mouse; no game state injection.'};
const base='http://127.0.0.1:4180/star-abyss.html?testLab=1&realm=4&arena=1&test=1&expeditionDebug=1';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
(async()=>{let browser,context,page;try{
 browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1.5});page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(`page: ${e.message}`));
 const bundle=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/game.js')).then(async r=>crypto.createHash('sha256').update(await r.body()).digest('hex'));
 const asset=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/assets/creatures/riftwing-r11/riftwing-r11.glb'),{timeout:120000}).then(async r=>crypto.createHash('sha256').update(await r.body()).digest('hex'));
 await page.goto(base);report.bundleSHA=await bundle;if(report.bundleSHA!==expected)throw Error(`Bundle SHA mismatch: ${report.bundleSHA} != ${expected}`);
 await page.waitForFunction(()=>window.__STAR_ABYSS_LAB__?.snapshot().lab.ready,null,{timeout:120000});
 report.assetSHA=await asset;if(report.assetSHA!==expectedAssetSHA)throw Error(`Riftwing GLB SHA mismatch: ${report.assetSHA} != ${expectedAssetSHA}`);
 const snap=async label=>{const s=await page.evaluate(()=>{const t=window.__STAR_ABYSS_TEST__.snapshot(),e=window.__ORIGINAL_EXPEDITION__.snapshot(),v=e.view,p=t.planet?.session?.flight,w=v?.enemies?.find(x=>x.id==='riftwing-hunter'),ev=document.querySelector('#expedition-evidence');let assets=null;try{assets=JSON.parse(ev?.textContent||'null')?.assetStatus}catch{}return{at:performance.now(),screen:t.screen,camera:t.cameraMode,locked:t.locked,captureStatus:t.captureStatus,gameplayError:v?.error||e.error||null,player:v?.player?{x:v.player.x,y:v.player.y,z:v.player.z,hp:v.player.hp,realm:v.player.realm}:null,flight:{active:p?.active,agl:p?.agl,speed:p?.speed,position:p?.position},enemy:w?{id:w.id,instanceId:w.instanceId,x:w.x,y:w.y,z:w.z,yaw:w.y,mode:w.mode,phase:w.phase,attack:w.attack,hp:w.hp,maxHp:w.maxHp,alive:w.alive}:null,riftwing:t.riftwing||null,assets,nearby:v?.nearby||null,drops:v?.drops||[],inventory:v?.inventory?.items||[],save:v?.save||null,revision:e.root?.revision,combat:{time:t.combat?.time,melee:t.combat?.aerialMelee,playerCast:t.combat?.playerCast},ui:{strip:document.querySelector('.expedition-strip')?.getBoundingClientRect().toJSON(),objective:document.querySelector('#hud .objective')?.getBoundingClientRect().toJSON(),beast:document.querySelector('[data-riftwing]')?.getBoundingClientRect().toJSON()}}});if(s.gameplayError&&!report.gameplayErrors.includes(s.gameplayError))report.gameplayErrors.push(s.gameplayError);for(const a of s.riftwing||[])if(a.clip&&!report.visualClips.includes(a.clip))report.visualClips.push(a.clip);if(label)report.samples.push({label,...s});return s;};
 const shot=async name=>{await page.screenshot({path:path.join(out,name)});report.screenshots.push(name)};
 const agl=async()=>page.evaluate(()=>{const test=window.__STAR_ABYSS_TEST__.snapshot();if(Number.isFinite(test.planetHud?.agl))return test.planetHud.agl;const label=document.querySelector('#flight-readout')?.textContent||'',match=label.match(/离地\s*([\d,]+)/);return match?Number(match[1].replaceAll(',','')):null});
 const enemy=async()=>{const s=await snap();if(!s.enemy)throw Error('Riftwing missing from authoritative view');return s};
 const panel=async()=>{const p=page.locator('#test-lab-panel');if(!await p.isVisible())await page.evaluate(()=>window.__STAR_ABYSS_LAB__.show());return p};
 const p=await panel();await p.locator('[data-action=riftwing]').click();await page.waitForFunction(()=>document.querySelector('#test-lab-panel').dataset.busy==='false',null,{timeout:30000});report.labStatus=await p.locator('#test-lab-status').textContent();if(await p.isVisible())await p.locator('[data-action=close]').click();await page.locator('#world').focus();await sleep(150);
 let s=await snap('spawn-ground');const id=s.enemy?.instanceId;if(!id||s.enemy?.mode!=='ground'||!s.enemy.alive)throw Error(`Riftwing spawn invalid: ${report.labStatus}`);
 if(s.camera==='first')await page.keyboard.press('KeyV');await shot('ground-approach-third-person.png');
 // Initial click grants pointer lock; a capture click must not launch a punch.
 await page.mouse.click(720,450,{button:'left'});await sleep(120);s=await snap('capture-click');
 const initialHp=s.enemy.hp,playerHp=s.player.hp;
 await page.mouse.down({button:'right'});const groundSeen=[];
 for(let i=0;i<45;i++){await sleep(100);s=await snap();if(s.enemy.attack?.kind)groundSeen.push({kind:s.enemy.attack.kind,mode:s.enemy.mode,phase:s.enemy.phase,at:s.at});if(i%5===0)report.samples.push({label:'ground-guard-'+i,...s});if(groundSeen.some(x=>x.kind==='claw')&&dist(s.player,s.enemy)<2.8)break}
 await page.mouse.up({button:'right'});report.groundAttackKinds=[...new Set(groundSeen.map(x=>x.kind))];await snap('ground-guard-released');await shot('ground-claw-third-person.png');
 // Real mouse motion adjusts heading when the opponent wanders; never call face/place/advance.
 let cursorX=720;
 async function turnToward(target){const cur=await snap(),desired=Math.atan2(cur.player.x-target.x,cur.player.z-target.z),yaw=await page.evaluate(()=>window.__STAR_ABYSS_TEST__.snapshot().player.yaw),delta=angle(desired-yaw),dx=Math.max(-250,Math.min(250,-delta/.0022));if(Math.abs(dx)>3){cursorX+=dx;await page.mouse.move(cursorX,450);await sleep(40)}return delta;}
 async function closeTo(target,radius=1.65){for(let i=0;i<20;i++){let q=await enemy();if(dist(q.player,q.enemy)<=radius)return q;await turnToward(q.enemy);await page.keyboard.down('KeyW');await sleep(120);await page.keyboard.up('KeyW');await sleep(40)}return enemy()}
 async function punchUntilDamage(limit,label){for(let i=0;i<limit;i++){s=await enemy();if(!s.enemy.alive)return s;await closeTo(s.enemy,1.8);const before=(await enemy()).enemy.hp;await page.mouse.click(cursorX,450,{button:'left'});await sleep(300);s=await snap(`${label}-${i}`);if(s.enemy.hp<before)return s;await sleep(140)}throw Error(`${label}: no authoritative HP reduction after ${limit} real clicks`)}
 s=await punchUntilDamage(6,'ground-punch');const groundHitHp=s.enemy.hp;await shot('ground-punch.png');
 // Held G must launch and climb; record the same actor's swept takeoff and pursuit.
 await page.keyboard.down('KeyG');const takeoff=[];for(let i=0;i<50;i++){await sleep(100);s=await snap();s.flight.agl=await agl();takeoff.push({at:s.at,agl:s.flight.agl,mode:s.enemy.mode,enemyY:s.enemy.y,playerY:s.player.y});if(i%5===0)report.samples.push({label:'G-ascent-'+i,...s});if(s.flight.active&&s.flight.agl>=9)break}await page.keyboard.up('KeyG');report.takeoff=takeoff;s=await snap('airborne-player');await shot('takeoff-third-person.png');
 // Move backward with actual S to leave a clear ordinary-flight window before the dive range.
 let flightShot=false;const separate=[];await page.keyboard.down('KeyS');for(let i=0;i<16;i++){await sleep(100);s=await snap();separate.push({at:s.at,distance:dist(s.player,s.enemy),mode:s.enemy.mode,clip:s.riftwing?.find(v=>v.id==='riftwing-hunter')?.clip});if(i%3===0)report.samples.push({label:'air-separation-'+i,...s});if(!flightShot&&s.riftwing?.some(v=>v.id==='riftwing-hunter'&&v.visible&&v.clip==='flight')){await shot('air-flight-third-person.png');flightShot=true}if(dist(s.player,s.enemy)>=9)break}await page.keyboard.up('KeyS');report.separation=separate;
 const airSeen=[];let closeAir=false;for(let i=0;i<100;i++){await sleep(70);s=await snap();if(s.enemy.attack?.kind)airSeen.push({kind:s.enemy.attack.kind,mode:s.enemy.mode,at:s.at});if(i%5===0)report.samples.push({label:'air-pursuit-'+i,...s});if(!flightShot&&s.riftwing?.some(v=>v.id==='riftwing-hunter'&&v.visible&&v.clip==='flight')){await shot('air-flight-third-person.png');flightShot=true}if(s.enemy.mode==='air'&&dist(s.player,s.enemy)<2.5)closeAir=true;if(closeAir&&airSeen.some(x=>['dive','sweep'].includes(x.kind)))break}report.airAttackKinds=[...new Set(airSeen.map(x=>x.kind))];s=await snap('air-contact');await shot('air-pursuit-third-person.png');
 await closeTo(s.enemy,1.6);s=await snap('air-before-punch');const beforeAirHp=s.enemy.hp,playerBeforeAir=s.player.hp;await page.mouse.click(cursorX,450,{button:'left'});await sleep(350);s=await snap('air-punch');await shot('air-punch-third-person.png');
 // C is the in-game descend key, not Ctrl. Release after actual ground contact.
 await page.keyboard.down('KeyC');const landing=[];for(let i=0;i<180;i++){await sleep(100);s=await snap();s.flight.agl=await agl();landing.push({at:s.at,agl:s.flight.agl,flight:s.flight.active,mode:s.enemy.mode,enemyY:s.enemy.y,playerY:s.player.y});if(i%10===0)report.samples.push({label:'C-descend-'+i,...s});if(!s.flight.active&&s.flight.agl<=.6)break}await page.keyboard.up('KeyC');report.landing=landing;
 for(let i=0;i<60&&s.enemy.mode!=='ground';i++){await sleep(100);s=await snap();if(i%10===0)report.samples.push({label:'enemy-landing-'+i,...s})}s=await snap('both-ground');await shot('both-ground-third-person.png');
 // Finish the same R4 actor with real clicks, movement and optional legal R casts.
 const kill=[];for(let i=0;i<65&&s.enemy.alive;i++){s=await enemy();if(!s.enemy.alive)break;await closeTo(s.enemy,1.75);await page.mouse.click(cursorX,450,{button:'left'});await sleep(360);s=await snap();kill.push({i,at:s.at,hp:s.enemy.hp,playerHp:s.player.hp,mode:s.enemy.mode,distance:dist(s.player,s.enemy)});if(i%5===0)report.samples.push({label:'finish-'+i,...s});if(s.player.hp<=0)throw Error('Player defeated during R4 finishing sequence');await sleep(120)}report.finishing=kill;s=await snap('dead-or-timeout');await shot('ground-kill-or-limit.png');await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await snap('dead-hud-settled');
 if(s.enemy.alive)throw Error(`R4 beast still alive after ${kill.length} real follow-up clicks: ${s.enemy.hp}/${s.enemy.maxHp}`);
 // The corpse and its one drop must persist. Approach with W before pressing H.
 for(let i=0;i<80&&(!s.drops.some(d=>d.id===id)||s.nearby?.action!=='loot');i++){await sleep(100);s=await snap();if(s.drops.some(d=>d.id===id)&&s.nearby?.action!=='loot')await closeTo(s.enemy,1.5)}s=await snap('drop-ready');await shot('ground-drop.png');
 const count=items=>items.filter(x=>x.name==='裂翼羽核').reduce((n,x)=>n+x.quantity,0),beforeLoot=count(s.inventory);await page.keyboard.down('KeyH');await sleep(120);await page.keyboard.up('KeyH');await sleep(350);s=await snap('H-pickup');await shot('ground-loot-inventory.png');report.loot={before:beforeLoot,after:count(s.inventory),drop:s.drops.find(d=>d.id===id)||null};
 const beforeReload={id:s.enemy.instanceId,hp:s.enemy.hp,loot:count(s.inventory),dropCount:s.drops.filter(d=>d.id===id).length,revision:s.revision};
 await page.waitForFunction(()=>window.__ORIGINAL_EXPEDITION__?.snapshot().view?.save?.status==='saved',null,{timeout:15000});await page.reload();await page.waitForFunction(()=>window.__STAR_ABYSS_LAB__?.snapshot().lab.ready,null,{timeout:120000});s=await snap('reload');report.reload={before:beforeReload,after:{id:s.enemy?.instanceId,hp:s.enemy?.hp,alive:s.enemy?.alive,loot:count(s.inventory),dropCount:s.drops.filter(d=>d.id===id).length,revision:s.revision}};
 const p2=await panel();await p2.locator('[data-action=riftwing]').click();await page.waitForFunction(()=>document.querySelector('#test-lab-panel').dataset.busy==='false',null,{timeout:30000});s=await snap('reenter-dead-encounter');report.reenter={id:s.enemy?.instanceId,alive:s.enemy?.alive,loot:count(s.inventory),dropCount:s.drops.filter(d=>d.id===id).length};if(await p2.isVisible())await p2.locator('[data-action=close]').click();await shot('reload-no-respawn.png');
 const a=report.assertions;
 a.bundleMatchesFreeze=report.bundleSHA===expected;
 a.assetMatchesLocal=report.assetSHA===expectedAssetSHA;
 a.assetReady=report.samples.find(x=>x.label==='spawn-ground')?.assets?.status==='ready';
 a.visualActorVisible=report.samples.some(x=>x.riftwing?.some(v=>v.id==='riftwing-hunter'&&v.visible));
 a.visualGroundAirDeath=['ground-claw','flight','land','death'].every(x=>report.visualClips.includes(x));
 const overlap=(a,b)=>!!a&&!!b&&a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;
 a.groundHudNoOverlap=!overlap(report.samples.find(x=>x.label==='both-ground')?.ui?.strip,report.samples.find(x=>x.label==='both-ground')?.ui?.objective);
 a.deadHudNoOverlap=!overlap(report.samples.find(x=>x.label==='dead-hud-settled')?.ui?.strip,report.samples.find(x=>x.label==='dead-hud-settled')?.ui?.objective);
 a.realGroundSpawn=!!id&&report.samples.find(x=>x.label==='spawn-ground')?.enemy?.mode==='ground';
 a.sameActorAcrossModes=report.samples.filter(x=>x.enemy).every(x=>x.enemy.instanceId===id);
 a.groundClawObserved=report.groundAttackKinds.includes('claw');
 a.realGroundMeleeDamage=groundHitHp<initialHp;
 a.heldGTakeoff=report.takeoff.some(x=>x.agl>=9);
 a.monsterFollowedToAir=report.samples.some(x=>['air-before-punch','air-punch','air-contact'].includes(x.label)&&x.enemy?.mode==='air'&&x.enemy.y>report.samples.find(y=>y.label==='spawn-ground').enemy.y+2&&x.enemy.instanceId===id);
 a.airAttackObserved=report.airAttackKinds.some(x=>['dive','sweep'].includes(x));
 a.airMeleeDamage=report.samples.find(x=>x.label==='air-punch')?.enemy?.hp<beforeAirHp;
 a.airThreat=report.samples.find(x=>x.label==='air-punch')?.player?.hp<playerBeforeAir||report.airAttackKinds.length>0;
 a.heldCLanding=report.landing.some(x=>x.flight===false&&x.agl<=.6);
 a.enemyLandedSameActor=report.samples.find(x=>x.label==='both-ground')?.enemy?.mode==='ground'&&report.samples.find(x=>x.label==='both-ground')?.enemy?.instanceId===id;
 a.groundKill=s.enemy?.alive===false;
 a.singleDrop=beforeReload.dropCount===1;
 a.realHPickup=report.loot.after===report.loot.before+1;
 a.reloadNoRespawn=report.reload.after.id===id&&report.reload.after.alive===false&&report.reenter.id===id&&report.reenter.alive===false;
 a.reloadNoDuplicateLoot=report.reload.after.loot===beforeReload.loot&&report.reenter.loot===beforeReload.loot&&report.reload.after.dropCount===1&&report.reenter.dropCount===1;
 a.noGameplayErrors=report.gameplayErrors.length===0;
 report.complete=report.errors.length===0&&Object.values(a).every(Boolean);if(!report.complete)process.exitCode=1;
 }catch(e){report.errors.push(e.stack||String(e));process.exitCode=1}finally{await context?.close();await browser?.close();save();console.log(JSON.stringify({complete:report.complete,bundleSHA:report.bundleSHA,assertions:report.assertions,errors:report.errors,gameplayErrors:report.gameplayErrors,screenshots:report.screenshots}))}})();
