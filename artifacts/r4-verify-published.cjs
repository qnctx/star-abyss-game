const fs=require('fs'),path=require('path'),crypto=require('crypto'),live='E:/myProject/star-abyss-game';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const manifest=JSON.parse(fs.readFileSync('artifacts/r4-published.json'));
 const r=await fetch('http://127.0.0.1:4173/game.js'),httpHash=hash(Buffer.from(await r.arrayBuffer()));
 if(!r.ok||httpHash!==manifest.bundleSHA)throw Error('Published HTTP bundle mismatch');
 const report=JSON.parse(fs.readFileSync('artifacts/r4-candidate/report.json'));
 if(!report.complete||report.bundleSHA!==httpHash)throw Error('Incomplete QA');
 const evidence=['artifacts/r4-published.json',...fs.readdirSync('artifacts/r4-candidate').filter(p=>/\.(json|png)$/.test(p)).map(p=>'artifacts/r4-candidate/'+p)];
 for(const p of evidence){const dst=path.join(live,p);fs.mkdirSync(path.dirname(dst),{recursive:true});if(fs.existsSync(dst)&&hash(fs.readFileSync(dst))!==hash(fs.readFileSync(p)))throw Error('Existing evidence conflict '+p);fs.copyFileSync(p,dst);}
 const docs=[];
 for(const p of ['README.md','docs/GAMEPLAY_TESTING.md']){
  const dst=path.join(live,p),before=fs.readFileSync(dst,'utf8');
  const link=p==='README.md'?'docs/development/FLIGHT-CONTROLS-R4.md':'development/FLIGHT-CONTROLS-R4.md';
  if(before.includes(link))continue;
  const note=`\n\n当前元婴自身飞行：**G 起飞/上升，空中 Space 上升、按住 C 下降、松开悬停**。原盆地地面 C 蹲伏，Ctrl 慢走保持；F2 高度跳转后先点“恢复键盘飞行”。见 [R4 飞行按键说明](${link})。\n`;
  const backup=path.join('artifacts/r4-docs-backup',p);if(fs.existsSync(backup))throw Error('Doc backup already exists');fs.mkdirSync(path.dirname(backup),{recursive:true});fs.writeFileSync(backup,before);
  fs.writeFileSync(dst,before+note);docs.push({file:p,before:hash(before),after:hash(before+note),operation:'append-control-note'});
 }
 fs.writeFileSync('artifacts/r4-published-verification.json',JSON.stringify({complete:true,httpStatus:r.status,httpHash,evidence,docs},null,2));console.log('HTTP verified',httpHash,'evidence',evidence.length);
})().catch(e=>{console.error(e);process.exitCode=1;});
