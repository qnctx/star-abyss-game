const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {FEATURES,parseArgs,createPlan,assessBrowser,releaseStatus}=require('../../tools/feature-test-plan.cjs');
const root=path.resolve(__dirname,'../..');
const green={suites:[{specs:[{tests:[{status:'expected',expectedStatus:'passed',results:[{status:'passed'}]}]}]}]};
test('every named gameplay suite resolves real rule and browser files',()=>{
  for(const name of Object.keys(FEATURES)) {const p=createPlan(root,parseArgs([name]));assert.ok(p.rules.length&&p.browser.length);}
});
test('all automatically includes every current browser and rule test',()=>{
  const p=createPlan(root,parseArgs(['all']));const files=fs.readdirSync(__dirname);
  const {discoverCpuTests}=require('../../tools/cpu-test-files.cjs');
  assert.deepEqual(p.rules,discoverCpuTests(root));
  assert.ok(p.rules.includes('playable/tests/planet-integration.test.mjs'));
  assert.ok(p.rules.includes('playable/src/progression-quests/quests.test.mjs'));
  assert.ok(p.rules.includes('tools/rules-test-gate.test.cjs'));
  assert.equal(p.browser.length,files.filter(f=>f.endsWith('.spec.js')).length);
});
test('unknown suite or flag fails instead of silently running a default',()=>{
  for(const args of [['dahs'],['dash','scan'],['dash','--skip']])assert.throws(()=>parseArgs(args));
  assert.equal(createPlan(root,parseArgs(['dash','--rules-only'])).browser.length,0);
});
test('browser gate rejects empty, skipped, expected failure, flaky, duplicate attempts and global errors',()=>{
  assert.equal(assessBrowser(green).ok,true);assert.equal(assessBrowser({suites:[]}).ok,false);
  for(const status of ['skipped','unexpected','flaky']) {const r=structuredClone(green);r.suites[0].specs[0].tests[0].status=status;assert.equal(assessBrowser(r).ok,false);}
  for(const change of [t=>t.expectedStatus='failed',t=>t.results=[],t=>t.results.push({status:'passed'}),t=>t.results[0].status='timedOut']) {
    const r=structuredClone(green);change(r.suites[0].specs[0].tests[0]);assert.equal(assessBrowser(r).ok,false);
  }
  assert.equal(assessBrowser({...green,errors:[{message:'worker crashed'}]}).ok,false);
});
test('partial, failed or changed runs cannot certify release; all green still requires manual review',()=>{
  const stages=['build','rules','browser'].map(name=>({name,exitCode:0}));const b=assessBrowser(green);
  assert.equal(releaseStatus({name:'dash'},stages,b,true),'FEATURE_PASSED_NOT_RELEASE');
  assert.equal(releaseStatus({name:'all',rulesOnly:true},stages,null,true),'RULES_ONLY_NOT_RELEASE');
  assert.equal(releaseStatus({name:'all'},stages,b,true),'AUTOMATION_PASSED_MANUAL_REVIEW_REQUIRED');
  assert.equal(releaseStatus({name:'all'},stages,b,false),'FAILED');
  assert.equal(releaseStatus({name:'all'},[{exitCode:1}],b,true),'FAILED');
  assert.equal(releaseStatus({name:'all'},stages,null,true),'FAILED');
  assert.equal(releaseStatus({name:'all'},[],b,true),'FAILED');
  assert.equal(releaseStatus({name:'all'},stages.slice(1),b,true),'FAILED');
});
