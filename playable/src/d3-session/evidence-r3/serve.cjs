const http=require('node:http'),fs=require('node:fs'),path=require('node:path');const base=path.resolve(__dirname,'../..');
const outputs=new Set(['browser.json','adapter.json','r2-browser-regression.json','refresh.json']);
http.createServer((req,res)=>{const u=new URL(req.url,'http://127.0.0.1');const relative=u.pathname.replace('/d3-session/evidence-r3/','');
 if(req.method==='POST'&&outputs.has(relative)){let b='';req.on('data',c=>{b+=c;if(b.length>20000000)req.destroy();});req.on('end',()=>{try{JSON.parse(b);fs.writeFileSync(path.join(__dirname,relative),b);res.end('saved');}catch{res.writeHead(400);res.end();}});return;}
 if(req.method!=='GET'){res.writeHead(405);res.end();return;}const file=path.resolve(base,'.'+decodeURIComponent(u.pathname));if(!file.startsWith(base+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(file,(e,b)=>{if(e){res.writeHead(404);res.end();return;}res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.mjs')?'text/javascript; charset=utf-8':'application/json');res.end(b);});
}).listen(4185,'127.0.0.1',()=>console.log('http://127.0.0.1:4185/d3-session/evidence-r3/verify.html'));
