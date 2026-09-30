const {chromium}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const folder=process.argv[2]||'artifacts/c2-lux3d-20260911';
 if(!/^artifacts\/[a-z0-9_-]+$/i.test(folder))throw new Error('Invalid artifact folder');
 const out=path.resolve(__dirname,'..',folder);
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const bundle=process.argv[3]||'delivery-final';
  if(!/^[a-z0-9_-]+$/i.test(bundle))throw new Error('Invalid delivery folder');
  await page.goto('file:///'+path.join(out,bundle,'preview.html').replace(/\\/g,'/'));
  await page.waitForFunction(()=>document.querySelector('canvas'));
  await page.waitForTimeout(1500);
  const report=await page.evaluate(()=>({title:document.title,canvases:[...document.querySelectorAll('canvas')].map(c=>({width:c.width,height:c.height})),horizontalOverflow:document.documentElement.scrollWidth>innerWidth}));
  await page.screenshot({path:path.join(out,'delivery-offline.png'),fullPage:true});
  fs.writeFileSync(path.join(out,'delivery-browser-audit.json'),JSON.stringify({...report,errors},null,2));
  console.log(JSON.stringify({...report,errors}));
  if(errors.length||!report.canvases.every(c=>c.width>0&&c.height>0))process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
