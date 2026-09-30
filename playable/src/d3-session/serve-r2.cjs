const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'..');
const outputs=new Set(['scene-browser-r2.json','r1-browser-regression-r2.json']);
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(req.method==='POST'&&url.pathname.startsWith('/d3-session/evidence-r2/')){
  const name=url.pathname.slice('/d3-session/evidence-r2/'.length);if(!outputs.has(name)){res.writeHead(403);res.end();return;}
  let body='';req.on('data',chunk=>{body+=chunk;if(body.length>20000000)req.destroy();});req.on('end',()=>{
   try{JSON.parse(body);fs.writeFileSync(path.join(__dirname,name),body);res.end('saved');}catch{res.writeHead(400);res.end();}
  });return;
 }
 if(req.method!=='GET'){res.writeHead(405);res.end();return;}
 let target;try{target=path.resolve(base,'.'+decodeURIComponent(url.pathname));}catch{res.writeHead(400);res.end();return;}
 if(!target.startsWith(base+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(target,(err,bytes)=>{if(err){res.writeHead(404);res.end();return;}res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',path.extname(target)==='.html'?'text/html; charset=utf-8':path.extname(target)==='.mjs'?'text/javascript; charset=utf-8':'application/json');res.end(bytes);});
}).listen(4180,'127.0.0.1',()=>console.log('http://127.0.0.1:4180/d3-session/verify-r2.html'));
