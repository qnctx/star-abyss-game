const fs=require('fs'),assert=require('node:assert/strict');
let s=fs.readFileSync('docs/test-lab/main.baseline.mjs','utf8');
for(const [before,after]of JSON.parse(fs.readFileSync('docs/test-lab/main-integration.json','utf8'))){assert.equal(s.split(before).length,2,'unique anchor: '+before);s=s.replace(before,after);}
assert.equal(s,fs.readFileSync('playable/src/main.mjs','utf8'),'exact integration reproduces validated main');
console.log('PASS exact main integration reproduces validated source');
