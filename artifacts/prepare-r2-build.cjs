const fs=require('fs'),path=require('path');
const dir='artifacts/r2-before-build';fs.mkdirSync(dir,{recursive:true});
for(const file of ['playable/game.js','playable/checkpoint-worker.js']){const dest=path.join(dir,path.basename(file));if(fs.existsSync(dest)){console.log('Preserved backup '+dest);continue;}fs.copyFileSync(file,dest,fs.constants.COPYFILE_EXCL);console.log('Backed up '+file);}
