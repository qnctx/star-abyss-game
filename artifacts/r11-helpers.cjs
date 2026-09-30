const fs=require('fs');
let cpu=fs.readFileSync('artifacts/r10-cpu-validate.cjs','utf8').replaceAll('artifacts/r10-','artifacts/r11-');
cpu=cpu.replace('const r=cp.spawnSync',"tests.push('playable/tests/riftwing-r11.test.mjs','playable/tests/riftwing-integration-r11.test.mjs');\nconst r=cp.spawnSync");
fs.writeFileSync('artifacts/r11-cpu-validate.cjs',cpu);
fs.writeFileSync('artifacts/r11-verify-published.cjs',fs.readFileSync('artifacts/r10-verify-published.cjs','utf8').replaceAll('artifacts/r10-','artifacts/r11-'));
