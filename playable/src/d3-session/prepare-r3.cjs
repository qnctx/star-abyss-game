const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const integrated=JSON.parse(fs.readFileSync('E:/myProject/star-abyss-game/docs/development/versions/INTEGRATED-I-R2.json'));
const rows=[];
for(const f of integrated.files){
 const source=fs.readFileSync(f.source),main=fs.readFileSync(f.target);
 if(sha(source)!==f.sha256||sha(main)!==f.sha256)throw Error('Integrated mismatch '+f.target);
 const relative=path.relative('E:/myProject/star-abyss-game',f.target).replaceAll('\\','/');
 if(relative.endsWith('TEST-I-R2.md'))continue;
 const local=fs.readFileSync(path.join(root,relative));if(sha(local)!==f.sha256)throw Error('Local R2 mismatch '+relative);
 rows.push({relative,sha256:f.sha256,bytes:local.length});
}
fs.mkdirSync(path.join(__dirname,'evidence-r3'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'evidence-r3/baseline.json'),JSON.stringify({baseline:'DEV-I-R2',gitBaseline:'5fdb455d3c46601ebd584e64bcf72a2b5c82baf4',files:rows},null,2));
console.log('Verified '+rows.length+' local/source/integrated R2 files');
