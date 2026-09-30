const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const base = __dirname;
(async () => {
  const prompts = JSON.parse(fs.readFileSync(path.join(base, 'PROMPTS.json'), 'utf8'));
  if (prompts.entries.length !== 12 || prompts.calls_so_far !== 12) throw new Error('Expected exactly 12 generation entries.');
  const report = {date: new Date().toISOString(), generationCalls: 12, tool: prompts.tool, verifiedModelVersion: null, files: [], viewports: []};
  for (const entry of prompts.entries) {
    const bytes = fs.readFileSync(path.join(base, entry.file));
    if (bytes.subarray(0,8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Invalid PNG: ' + entry.file);
    const source = fs.readFileSync(entry.source);
    if (!bytes.equals(source)) throw new Error('Copy differs from generated source: ' + entry.file);
    report.files.push({file:entry.file, width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),exactSourceCopy:true});
  }
  const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
  for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
    if(!fs.existsSync(path.join(base,match[1])))throw new Error('Broken local reference: '+match[1]);
  }
  const qa=path.join(base,'qa');fs.mkdirSync(qa,{recursive:true});
  const browser=await chromium.launch({headless:true});
  try {
    for (const width of [1440,390]) {
      const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(pathToFileURL(path.join(base,'index.html')).href);
      await page.evaluate(async()=>{for(const image of document.images){image.loading='eager';await image.decode();}});
      const data=await page.evaluate(()=>{
        const bad=[];
        for(const a of document.querySelectorAll('.original,nav a')){const r=a.getBoundingClientRect();if(r.left<0||r.right>innerWidth+1||r.width<1||r.height<1)bad.push(a.textContent);}
        return {loadedImages:[...document.images].filter(i=>i.complete&&i.naturalWidth>0).length,horizontalOverflow:document.documentElement.scrollWidth>innerWidth,clippedControls:bad,articleCount:document.querySelectorAll('article').length};
      });
      if(data.loadedImages!==12||data.articleCount!==12||data.horizontalOverflow||data.clippedControls.length||errors.length)throw new Error(JSON.stringify({width,...data,errors}));
      await page.screenshot({path:path.join(qa,'gallery-'+width+'.png')});
      await page.locator('#p12').scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(qa,'special-regions-'+width+'.png')});
      const popupWait=page.waitForEvent('popup');
      await page.locator('#p12 .original').click();
      const popup=await popupWait;await popup.waitForLoadState('domcontentloaded');
      const originalOpens=popup.url().endsWith('12-special-regions.png');
      if(!originalOpens)throw new Error('Original image link failed.');
      await popup.close();
      report.viewports.push({width,...data,originalOpens,pageErrors:errors});
      await page.close();
    }
  } finally {await browser.close();}
  report.status='pass';fs.writeFileSync(path.join(qa,'verification.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({status:report.status,images:report.files.length,viewports:report.viewports},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});

