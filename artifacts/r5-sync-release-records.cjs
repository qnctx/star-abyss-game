const fs=require('fs'),path=require('path');
for(const name of ['r5-published.json','r5-published-verification.json']){
 const source=path.join('artifacts',name),dest=path.join('E:/myProject/star-abyss-game/artifacts',name),bytes=fs.readFileSync(source);
 if(fs.existsSync(dest)&&!fs.readFileSync(dest).equals(bytes))throw Error('Conflicting release record '+name);
 fs.copyFileSync(source,dest);
 if(!fs.readFileSync(dest).equals(bytes))throw Error('Copy mismatch '+name);
 console.log('Verified '+name);
}
