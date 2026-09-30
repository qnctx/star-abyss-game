const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../../..');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const run=args=>{const r=cp.spawnSync(process.execPath,args,{cwd:root,encoding:'utf8'});if(r.status!==0)throw Error(r.stdout+r.stderr);return r.stdout;};
const frozen='C:/Users/HUAWEI/.codex/worktrees/c0e3/star-abyss-game/artifacts/deliveries/DEV-I-R1';
const old=JSON.parse(fs.readFileSync(path.join(frozen,'manifest.json')));
const frozenProof=old.files.map(row=>{const bytes=fs.readFileSync(path.join(frozen,row.path));if(digest(bytes)!==row.sha256||bytes.length!==row.bytes)throw Error('Frozen R1 mismatch '+row.path);return {path:row.path,sha256:row.sha256};});
const dependencies=JSON.parse(run(['playable/src/d3-session/verify-dependencies.cjs']));
fs.writeFileSync(path.join(__dirname,'node-tests-r2.tap'),run(['--test','playable/tests/d3-session.test.js']));
run(['playable/src/d3-session/replay-r1-r2.cjs']);
for(const f of fs.readdirSync(__dirname).filter(f=>/\.(cjs|mjs)$/.test(f)))run(['--check',path.join(__dirname,f)]);
for(const [file,count] of [['scene-browser-r2.json',7],['r1-browser-regression-r2.json',10]]) {
 const e=JSON.parse(fs.readFileSync(path.join(__dirname,file)));if(!e.pass||e.cases.length!==count)throw Error('Browser evidence failure '+file);
}
const relativeFiles=[...fs.readdirSync(__dirname).filter(f=>f!=='version-r2.json').map(f=>'playable/src/d3-session/'+f),
 'playable/tests/d3-session.test.js','docs/development/reports/DEV-I.md'];
const files=relativeFiles.sort().map(relative=>{const b=fs.readFileSync(path.join(root,relative)),prior=old.files.find(r=>r.path===relative);return {relative,bytes:b.length,sha256:digest(b),change:prior?(prior.sha256===digest(b)?'unchanged':'modified'):'added'};});
const version={version:'DEV-I-R2',threadId:process.env.CODEX_THREAD_ID,workspace:root,baseline:'5fdb455d3c46601ebd584e64bcf72a2b5c82baf4',
 frozenAt:new Date().toISOString(),nodeTests:'14/14; original13 + 1 wrapper containing 7 R2 groups',r1NodeRegression:'10/10',
 realIDB:'R2 7/7; R1 independent regression 10/10; developer verification only',frozenR1Source:frozen,frozenR1Proof:frozenProof,dependencies,files};
fs.writeFileSync(path.join(__dirname,'version-r2.json'),JSON.stringify(version,null,2));
console.log(JSON.stringify({files:files.length,modified:files.filter(f=>f.change==='modified').map(f=>f.relative),node:version.nodeTests,browser:version.realIDB,frozenR1FilesVerified:frozenProof.length}));
