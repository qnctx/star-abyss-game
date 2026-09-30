const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {FEATURES,parseArgs,createPlan,assessBrowser,releaseStatus}=require('./feature-test-plan.cjs');
const {assessRules}=require('./rules-test-gate.cjs');
const root=path.resolve(__dirname,'..');

// Hash the actual playable artifact AND sources/assets; reports must not certify
// another revision edited while a long browser suite was still running.
function fingerprint() {
  const hash=crypto.createHash('sha256');
  const visit=relative=>{
    const absolute=path.join(root,relative);
    if(fs.statSync(absolute).isDirectory()) {
      for(const entry of fs.readdirSync(absolute).sort()) visit(`${relative}/${entry}`);
    } else { hash.update(relative+'\0');hash.update(fs.readFileSync(absolute)); }
  };
  for(const relative of ['playable/src','playable/assets','playable/css','playable/star-abyss.html','playable/game.js','playable/tests','tools/cpu-test-files.cjs','tools/feature-test-plan.cjs','tools/test-feature.cjs','tools/rules-test-gate.cjs','tools/rules-test-gate.test.cjs','tools/playwright.feature.config.cjs','docs/ui-implementation/human-locomotion-preview.html','package.json','package-lock.json']) visit(relative);
  return hash.digest('hex');
}

function main() {
  const options=parseArgs(process.argv.slice(2));
  if(options.list) {
    console.log('单项：npm run test:feature -- <名称> [--headed] [--rules-only] [--plan]');
    for(const [name,feature] of Object.entries(FEATURES)) console.log(`  ${name.padEnd(13)} ${feature.label}`);
    console.log('  all           全部已实现玩法（自动发现所有测试文件）');return;
  }
  const plan=createPlan(root,options);
  if(options.plan) { console.log(JSON.stringify(plan,null,2));return; }
  const id=new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid;
  const reportDir=path.join(root,'playable/test-artifacts',id+'-'+plan.name);
  fs.mkdirSync(reportDir,{recursive:true});
  const stages=[];let browser=null;let rules=null;let before=null;let after=null;
  const execute=(name,args)=>{
    console.log(`\n[${name}] ${plan.label}；日志：${path.join(reportDir,name+'.log')}`);
    const start=Date.now();
    const log=fs.openSync(path.join(reportDir,name+'.log'),'w');
    let result;
    try { result=spawnSync(process.execPath,args,{cwd:root,env:{...process.env,STAR_ABYSS_TEST_REPORT:reportDir},stdio:['ignore',log,log],windowsHide:true,timeout:60*60*1000}); }
    finally {fs.closeSync(log);}
    const exitCode=result.status ?? 1;
    stages.push({name,exitCode,durationMs:Date.now()-start,error:result.error?.message || null});
    console.log(`[${name}] ${exitCode===0?'通过':'失败'} (${Math.round((Date.now()-start)/1000)} s)`);
    if(exitCode!==0) console.log(fs.readFileSync(path.join(reportDir,name+'.log'),'utf8').slice(-6000));
    return exitCode===0;
  };
  try {
    const built=execute('build',[require.resolve('esbuild/bin/esbuild'),'playable/src/main.mjs','--bundle','--format=iife','--target=chrome105','--minify','--legal-comments=eof','--outfile=playable/game.js']);
    if(built) {
      before=fingerprint();
      const rulesExit=execute('rules',['--test','--test-reporter=tap',...plan.rules]);
      rules=assessRules(fs.readFileSync(path.join(reportDir,'rules.log'),'utf8'));
      if(!rules.ok) { stages.push({name:'rules-coverage',exitCode:1,error:'规则必须非空、全部通过且无跳过/TODO/取消。'});console.error('规则覆盖门禁未通过。'); }
      if(rulesExit && rules.ok && plan.browser.length) {
        const args=[require.resolve('@playwright/test/cli'),'test','--config=tools/playwright.feature.config.cjs',...plan.browser];
        if(plan.headed)args.push('--headed');
        execute('browser',args);
        if(fs.existsSync(path.join(reportDir,'browser.json'))) browser=assessBrowser(JSON.parse(fs.readFileSync(path.join(reportDir,'browser.json'),'utf8')));
      }
      after=fingerprint();
    }
  } catch(error) { stages.push({name:'runner',exitCode:1,error:error.message});console.error(error.message); }
  const status=releaseStatus(plan,stages,browser,!!before && before===after);
  const summary={id,createdAt:new Date().toISOString(),status,plan,stages,rules,browser,fingerprintBefore:before,fingerprintAfter:after,
    manualReview:['目标机器性能与长时间运行','3D多角度视觉、动作与手感','正式托管环境/HTTPS与存档兼容','未实现功能范围确认'],deployed:false};
  fs.writeFileSync(path.join(reportDir,'summary.json'),JSON.stringify(summary,null,2));
  fs.writeFileSync(path.join(reportDir,'README.md'),`# ${plan.label}\n\n状态：${status}\n\n${stages.map(s=>`- ${s.name}: ${s.exitCode===0?'通过':'失败'}`).join('\n')}\n\n浏览器：${browser?`${browser.passed}/${browser.total}，不通过 ${browser.blocked}`:'未完成'}\n\n此结果不自动部署。单项或纯规则通过不等于发布通过。完整自动化通过后仍需人工验收。\n\nHTML 详情：html/index.html；结构化汇总：summary.json；各阶段日志：*.log。\n`);
  console.log(`\n${status}\n报告：${reportDir}\n本工具不会上线或发布游戏。`);
  process.exitCode=status==='FAILED'?1:0;
}
try { main(); } catch(error) {console.error(error.message);process.exitCode=1;}
