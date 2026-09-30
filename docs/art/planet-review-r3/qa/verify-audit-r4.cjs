const fs=require('node:fs'),path=require('node:path'),{pathToFileURL,fileURLToPath}=require('node:url'),crypto=require('node:crypto'),{chromium}=require('playwright');
const base=path.resolve(__dirname,'..'),url=pathToFileURL(path.join(base,'COMPARISON.html')).href;
(async()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(base,'qa/audit-r4/manifest.json'),'utf8'));
 if(manifest.sameViewPairs!==0||manifest.cards.length!==15)throw Error('Incorrect evidence labels');
 for(const c of manifest.cards){if(c.sameView!==false)throw Error('Unverified camera claim');if(c.snapshot){const h=crypto.createHash('sha256').update(fs.readFileSync(path.join(base,c.snapshot))).digest('hex');if(h!==c.actualSHA256)throw Error('Evidence changed');}}
 const browser=await chromium.launch({headless:true}),results=[];
 try{for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.evaluate(async()=>{for(const i of document.images){i.loading='eager';await i.decode();}});
  for(const href of await page.locator('a').evaluateAll(as=>as.map(a=>a.href)))if(!fs.existsSync(fileURLToPath(href)))throw Error('Missing link '+href);
  const check=await page.evaluate(()=>({images:[...document.images].filter(i=>i.complete&&i.naturalWidth>0).length,overflow:document.documentElement.scrollWidth>innerWidth,cards:document.querySelectorAll('article').length,missing:document.querySelectorAll('.missing').length,clippedLinks:[...document.querySelectorAll('a.link,nav a')].filter(a=>{const r=a.getBoundingClientRect();return r.left<0||r.right>innerWidth+1||r.width<1||r.height<1;}).map(a=>a.textContent)}));
  if(check.images!==25||check.cards!==15||check.missing!==5||check.overflow||check.clippedLinks.length||errors.length)throw Error(JSON.stringify({width,...check,errors}));
  await page.screenshot({path:path.join(base,'qa/audit-r4/page-'+width+'.png')});
  await page.locator('#p05').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(base,'qa/audit-r4/forest-'+width+'.png')});
  const popupPromise=page.waitForEvent('popup');await page.locator('#p05 .link').last().click();const popup=await popupPromise;await popup.waitForLoadState();if(!popup.url().endsWith('/qa/audit-r4/05.png'))throw Error('Wrong actual image link');await popup.close();
  results.push({width,...check,pageErrors:errors,actualLinkClickable:true});await page.close();
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(base,'qa/audit-r4/ui-check.json'),JSON.stringify({status:'pass',scope:'document provenance and layout only; art acceptance failed',results},null,2));console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exitCode=1;});
