const {chromium}=require('@playwright/test');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const folder=process.argv[4]||'artifacts/c2-lux3d-20260911';
if(!/^artifacts\/[a-z0-9_-]+$/i.test(folder))throw new Error('Invalid artifact folder');
const model=process.argv[2]||'c2-source_glb.glb';
const label=process.argv[3]||'source';
if(!/^[a-z0-9_-]+$/i.test(label))throw new Error('Invalid screenshot label');
const errors=[];
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.glb':'model/gltf-binary'};
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data);});
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1200},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/${folder}/workbench.html?model=${encodeURIComponent(model)}${process.argv.includes('--clay')?'&clay=1':''}`);
  await page.waitForFunction(()=>window.c2AssetPreview?.ready||window.c2AssetPreview?.error,{},{timeout:120000});
  const report=await page.evaluate(()=>({...window.c2AssetPreview.report,error:window.c2AssetPreview.error}));
  if(report.error)throw new Error(report.error);
  await page.screenshot({path:path.join(root,folder,`${label}-eight-angles.png`),fullPage:true});
  fs.writeFileSync(path.join(root,folder,`${label}-browser-audit.json`),JSON.stringify({...report,errors},null,2));
  console.log(JSON.stringify({...report,errors}));
  if(errors.length)process.exitCode=1;
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e.message);server.close();process.exitCode=1;});
