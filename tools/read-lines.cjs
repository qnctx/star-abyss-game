const fs=require('node:fs');const [file,start,end]=process.argv.slice(2);console.log(fs.readFileSync(file,'utf8').split('\n').slice(+start-1,+end).map((s,i)=>`${+start+i}: ${s}`).join('\n'));
