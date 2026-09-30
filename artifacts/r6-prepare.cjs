const fs=require('fs');
const dest='artifacts/r6-release.cjs';
if(fs.existsSync(dest))throw Error('R6 release helper exists');
fs.writeFileSync(dest,fs.readFileSync('artifacts/r5-release.cjs','utf8').replaceAll('r5-','r6-').replaceAll('r5c-candidate','r6-candidate'));
