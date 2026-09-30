const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process');
const root='E:/myProject/star-abyss-game';
const probe=()=>new Promise(resolve=>{const q=http.get('http://127.0.0.1:4173/test-lab.html',r=>{r.resume();resolve(r.statusCode===200);});q.setTimeout(2000,()=>q.destroy());q.on('error',()=>resolve(false));});
(async()=>{if(await probe()){console.log('Test preview already healthy on port 4173');return;}
 const dir=path.join(root,'artifacts','local-preview');fs.mkdirSync(dir,{recursive:true});
 const out=fs.openSync(path.join(dir,'server.log'),'a');
 const child=spawn(process.execPath,[path.join(root,'playable/tests/static-server.js')],{cwd:root,detached:true,windowsHide:true,stdio:['ignore',out,out],env:{...process.env,PORT:'4173'}});
 child.on('error',e=>{console.error(e.message);process.exitCode=1;});child.unref();fs.closeSync(out);
 fs.writeFileSync(path.join(dir,'server.json'),JSON.stringify({pid:child.pid,started:new Date().toISOString(),port:4173,root},null,2));
 for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,250));if(await probe()){console.log('Restored http://127.0.0.1:4173/test-lab.html ; detached PID '+child.pid);return;}}
 throw Error('Preview did not become ready; inspect '+dir);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
