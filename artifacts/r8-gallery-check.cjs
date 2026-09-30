const fs=require('fs'),path=require('path'),crypto=require('crypto'),{chromium}=require('@playwright/test');
const out=path.resolve('artifacts/r8-gallery');fs.mkdirSync(out,{recursive:true});
const report={at:new Date().toISOString(),url:'http://127.0.0.1:4180/ascension-gallery.html',realms:[],errors:[],complete:false,screenshots:[]};
(async()=>{let browser;try{
 browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1.5});const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 const bundle=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/ascension-gallery.js')).then(async r=>crypto.createHash('sha256').update(await r.body()).digest('hex'));
 await page.goto(report.url);report.bundleSHA=await bundle;await page.waitForFunction(()=>window.__ASCENSION_GALLERY__?.snapshot().loaded,null,{timeout:30000});
 for(let realm=4;realm<=9;realm++){
  await page.locator(`#cards button[data-realm="${realm}"]`).click();await page.waitForFunction(r=>{const s=window.__ASCENSION_GALLERY__?.snapshot();return s?.realm===r&&s.loaded;},realm,{timeout:30000});
  const state=await page.evaluate(()=>({snapshot:window.__ASCENSION_GALLERY__.snapshot(),tryURL:document.querySelector('#try').href,glb:document.querySelector('#glb').href,blend:document.querySelector('#blend').href,downloadLabels:[document.querySelector('#glb').textContent,document.querySelector('#blend').textContent]}));
  const glb=await page.request.get(state.glb),blend=await page.request.get(state.blend);const item={realm,loaded:state.snapshot.loaded,meshes:state.snapshot.meshes,status:state.snapshot.status,tryURL:state.tryURL,glbURL:state.glb,blendURL:state.blend,glbHTTP:glb.status(),blendHTTP:blend.status()};report.realms.push(item);
  if(realm===9){const file='R9-wide.png';await page.screenshot({path:path.join(out,file)});report.screenshots.push(file);}
 }
 await page.setViewportSize({width:390,height:640});await page.waitForTimeout(300);const file='R9-narrow.png';await page.screenshot({path:path.join(out,file),fullPage:true});report.screenshots.push(file);
 report.narrow=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,links:[...document.querySelectorAll('.actions a')].map(a=>({text:a.textContent,rect:a.getBoundingClientRect().toJSON()}))}));
 report.complete=report.errors.length===0&&report.realms.length===6&&report.realms.every(x=>x.loaded&&x.meshes.length>0&&x.glbHTTP===200&&x.blendHTTP===200)&&report.narrow.scrollWidth<=report.narrow.viewport;
 if(!report.complete)process.exitCode=1;
 await context.close();
 }catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser?.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({complete:report.complete,realms:report.realms.map(x=>({realm:x.realm,meshes:x.meshes.length,glb:x.glbHTTP,blend:x.blendHTTP})),narrow:report.narrow,errors:report.errors,failure:report.failure}));}})();
