const fs=require('fs');
let s=fs.readFileSync('artifacts/r9-release.cjs','utf8').replaceAll('r8-','r9-');
fs.writeFileSync('artifacts/r9-release.cjs',s);
