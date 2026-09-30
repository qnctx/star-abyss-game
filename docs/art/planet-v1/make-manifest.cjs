const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..');
const files=fs.readdirSync(__dirname).filter(f=>f!=='manifest.json').map(f=>'docs/art/planet-v1/'+f).concat(['playable/src/planet-art/index.mjs','playable/tests/planet-art.test.mjs']).sort();
const manifest={version:'PLANET-ART-V1',root:root.replaceAll('\\','/'),files:files.map(relative=>{const absolute=path.join(root,relative),data=fs.readFileSync(absolute);return {relative,absolute:absolute.replaceAll('\\','/'),bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};})};
fs.writeFileSync(path.join(__dirname,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
