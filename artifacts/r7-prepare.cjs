const fs=require('fs');
for(const base of ['release','verify-published']){
 const dest='artifacts/r7-'+base+'.cjs';
 if(fs.existsSync(dest))throw Error('R7 helper exists');
 fs.writeFileSync(dest,fs.readFileSync('artifacts/r6-'+base+'.cjs','utf8').replaceAll('r6-','r7-'));
}
