const {chromium}=require('@playwright/test');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),folder=process.argv[2]||'artifacts/c2-lux3d-20260911';
if(!/^artifacts\/[a-z0-9_-]+$/i.test(folder))throw new Error('Invalid artifact folder');
const out=path.join(root,folder),candidate=process.argv[3];
const errors=[];
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript':'application/octet-stream');res.end(data);});
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/docs/ui-implementation/c2-character-preview.html${candidate?'?model='+encodeURIComponent('/'+folder+'/'+candidate):''}`);
  await page.waitForFunction(()=>window.c2Preview);
  const asset=await page.evaluate(()=>window.c2Preview.assetReady);
  if(asset.status!=='ready')throw new Error(JSON.stringify(asset));
  const modes={};
  for(const mode of ['idle','walk','run','left','right','back']){
   modes[mode]=await page.evaluate(mode=>{
    const p=window.c2Preview;p.reset(mode);let maxSpan=0;
    for(let i=0;i<36;i++){p.advance(2,false);for(const b of p.assetBounds()){
     if(![...b.min,...b.max].every(Number.isFinite))throw new Error('Nonfinite skinned position');
     maxSpan=Math.max(maxSpan,...b.max.map((v,j)=>v-b.min[j]));
    }}
    p.render();return {maxSpan,pose:p.snapshot(),bounds:p.assetBounds()};
   },mode);
   if(modes[mode].maxSpan>2.8)throw new Error(`${mode}: skin exploded`);
   await page.screenshot({path:path.join(out,`game-${mode}-eight-angles.png`),fullPage:true});
  }
  fs.writeFileSync(path.join(out,'motion-browser-audit.json'),JSON.stringify({asset,modes,errors},null,2));
  if(candidate){console.log(JSON.stringify({asset,modes:Object.fromEntries(Object.entries(modes).map(([m,v])=>[m,{maxSpan:v.maxSpan}])),errors}));return;}
  await page.goto('file:///'+path.join(root,'docs/ui-implementation/c2-character-preview.html').replace(/\\/g,'/'));
  await page.waitForFunction(()=>window.c2Preview);
  const offlineAsset=await page.evaluate(()=>window.c2Preview.assetReady);
  if(offlineAsset.status!=='ready')throw new Error('Offline preview did not load the authored skin');
  await page.goto('file:///'+path.join(root,'playable/star-abyss.html').replace(/\\/g,'/')+'?test=1');
  await page.waitForFunction(()=>window.__STAR_ABYSS_TEST__?.snapshot().avatarPose.characterAsset.status==='ready');
  await page.locator('#start-button').click();await page.keyboard.press('KeyV');
  await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().cameraMode==='third');
  const game=await page.evaluate(()=>__STAR_ABYSS_TEST__.snapshot());
  await page.screenshot({path:path.join(out,'actual-game-third-person.png'),fullPage:true});
  fs.writeFileSync(path.join(out,'offline-game-audit.json'),JSON.stringify({offlineAsset,asset:game.avatarPose.characterAsset,cameraMode:game.cameraMode,screen:game.screen,errors},null,2));
  console.log(JSON.stringify({asset,modes:Object.fromEntries(Object.entries(modes).map(([m,v])=>[m,{maxSpan:v.maxSpan}])),errors}));
  if(errors.length)process.exitCode=1;
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e.message);server.close();process.exitCode=1;});
