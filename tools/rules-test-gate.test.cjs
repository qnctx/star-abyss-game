const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {assessRules}=require('./rules-test-gate.cjs');

function actualReport(t,body) {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'star-abyss-rule-gate-'));
  // This directory is returned directly by mkdtemp, contains only this test's
  // fixture, and is never derived from game files or a user-supplied path.
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const file=path.join(directory,'fixture.test.cjs');
  fs.writeFileSync(file,body);
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const result=spawnSync(process.execPath,['--test','--test-reporter=tap',file],{env,encoding:'utf8',windowsHide:true,timeout:15000});
  assert.equal(result.error,undefined);
  return result;
}

test('actual Node passing and failing rules are assessed from TAP totals',t=>{
  const passed=actualReport(t,"const {test}=require('node:test');test('real rule',()=>{});");
  assert.equal(passed.status,0);
  assert.deepEqual(assessRules(passed.stdout),{total:1,passed:1,failed:0,cancelled:0,skipped:0,todo:0,ok:true});
  const failed=actualReport(t,"const {test}=require('node:test');test('broken rule',()=>{throw Error('broken');});");
  assert.notEqual(failed.status,0);
  assert.equal(assessRules(failed.stdout).failed,1);assert.equal(assessRules(failed.stdout).ok,false);
});

for(const [name,body,counter] of [
  ['skip',"const {test}=require('node:test');test.skip('not exercised',()=>{});",'skipped'],
  ['todo',"const {test}=require('node:test');test.todo('not implemented');",'todo'],
  ['empty file','',null],
]) test(`actual Node ${name} cannot green the gate despite exit code zero`,t=>{
  const result=actualReport(t,body);assert.equal(result.status,0);
  const assessed=assessRules(result.stdout);
  if(counter)assert.equal(assessed[counter],1);
  assert.equal(assessed.ok,false,result.stdout);
});

test('truncated, empty, invalid, overflow and contradictory summaries fail closed',()=>{
  const tail='# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 1.25\n';
  assert.equal(assessRules(tail).ok,true);
  for(const report of [null,'',tail.replace('# skipped 0\n',''),tail.replace('# tests 1','# tests -1'),tail.replace('# tests 1','# tests 1.5'),tail.replace('# tests 1','# tests 9007199254740992'),tail.replace('# pass 1','# pass 0'),tail.replace('# cancelled 0','# cancelled 1'),tail.replace('# tests 1','# tests 0').replace('# pass 1','# pass 0'),tail+'unfinished output',tail.replace('# duration_ms 1.25','# duration_ms NaN')])assert.equal(assessRules(report).ok,false,String(report));
  assert.equal(assessRules(tail.replaceAll('\n','\r\n')).ok,true);
});
