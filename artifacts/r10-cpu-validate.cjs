const fs=require('fs'),crypto=require('crypto'),cp=require('child_process');
const tests=['aerial-animation-r9.test.mjs','aerial-melee-r9.test.mjs','air-recoil-r9.test.mjs','flight-steering-r9.test.mjs','aerial-combat-r8.test.mjs','ascension-effects-r8.test.mjs','ascension-flight-r8.test.mjs','flight-aim-r8.test.mjs','input.test.js','test-lab.test.mjs','d3-session.test.js','planet-runtime-world.test.mjs','flight-hud-r2.test.mjs','innate-takeoff-r6.test.mjs'].map(p=>'playable/tests/'+p);
tests.push('playable/tests/aerial-footwork-r9.test.mjs');
const r=cp.spawnSync(process.execPath,['--test',...tests],{encoding:'utf8',maxBuffer:8*1024*1024});fs.writeFileSync('artifacts/r10-cpu.log',r.stdout+r.stderr);
const lines=r.stdout.split(/\r?\n/),summary=lines.filter(x=>/^# (tests|pass|fail|duration_ms|cancelled|skipped)/.test(x));console.log(summary.join('\n'));
if(r.status!==0){console.log(lines.filter((x,i)=>x.startsWith('not ok')||x.includes('error:')).join('\n'));process.exitCode=r.status||1;}
fs.writeFileSync('artifacts/r10-cpu-validation.json',JSON.stringify({complete:r.status===0,bundleSHA:crypto.createHash('sha256').update(fs.readFileSync('playable/game.js')).digest('hex'),tests,summary,at:new Date().toISOString()},null,2));
