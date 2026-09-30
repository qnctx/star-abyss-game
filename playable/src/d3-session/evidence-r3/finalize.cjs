const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const session=path.resolve(__dirname,'..'),root=path.resolve(session,'../../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const base=JSON.parse(fs.readFileSync(path.join(__dirname,'baseline.json')));
const changed=new Set(['docs/development/reports/DEV-I.md','playable/src/d3-session/index.mjs','playable/src/d3-session/indexeddb.mjs','playable/src/d3-session/scene.mjs','playable/tests/d3-session.test.js']);
for(const f of base.files){
 const frozen=path.join('C:/Users/HUAWEI/.codex/worktrees/c0e3/star-abyss-game/artifacts/deliveries/DEV-I-R2',f.relative);
 if(sha(fs.readFileSync(frozen))!==f.sha256)throw Error('Frozen R2 changed '+f.relative);
 if(!changed.has(f.relative)&&sha(fs.readFileSync(path.join(root,f.relative)))!==f.sha256)throw Error('Historical file changed '+f.relative);
}
const run=args=>{const r=cp.spawnSync(process.execPath,args,{cwd:root,encoding:'utf8'});if(r.status!==0)throw Error(r.stdout+r.stderr);return r.stdout;};
fs.writeFileSync(path.join(__dirname,'node.tap'),run(['--test','playable/tests/d3-session.test.js']));
const deps=JSON.parse(run(['playable/src/d3-session/verify-dependencies.cjs']));
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);
const paths=[...walk(session).filter(p=>path.basename(p)!=='version-r3.json'),path.join(root,'playable/tests/d3-session.test.js'),path.join(root,'docs/development/reports/DEV-I.md')];
for(const p of paths.filter(p=>/\.(cjs|mjs|js)$/.test(p)))run(['--check',p]);
for(const name of ['browser.json','adapter.json','r2-browser-regression.json','refresh.json'])if(!JSON.parse(fs.readFileSync(path.join(__dirname,name))).pass)throw Error('Evidence failed '+name);
const files=paths.map(p=>{const b=fs.readFileSync(p),relative=path.relative(root,p).replaceAll('\\','/'),previous=base.files.find(f=>f.relative===relative);return {relative,bytes:b.length,sha256:sha(b),previousSha256:previous?.sha256??null};});
fs.writeFileSync(path.join(session,'version-r3.json'),JSON.stringify({version:'DEV-I-R3',threadId:process.env.CODEX_THREAD_ID,workspace:root,gitBaseline:base.gitBaseline,
 frozenAt:new Date().toISOString(),baseline:'DEV-I-R2',baselineFiles:base.files,dependencies:deps,files,node:'15/15 (R2 seven groups + R3 five groups inside two wrapper tests)',browser:'R3 5/5 + adapter 1/1 + R2 7/7 + actual page refresh'},null,2));
console.log(JSON.stringify({files:files.length,baselineFilesVerified:base.files.length,modified:files.filter(f=>f.previousSha256&&f.previousSha256!==f.sha256).map(f=>f.relative)}));
