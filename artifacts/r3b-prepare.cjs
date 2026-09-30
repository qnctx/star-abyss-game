const fs=require('fs');
for(const name of ['release.cjs','verify-published.cjs']){const src=fs.readFileSync('artifacts/r3-'+name,'utf8');const target='artifacts/r3b-'+name;if(fs.existsSync(target))throw Error('Already prepared');fs.writeFileSync(target,src.replaceAll('r3-','r3b-'));}
fs.copyFileSync('artifacts/r3-release-files.json','artifacts/r3b-release-files.json');
