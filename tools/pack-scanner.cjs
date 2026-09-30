const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const dir=path.resolve(__dirname,'../playable/assets/equipment'),bytes=fs.readFileSync(path.join(dir,'explorer-scanner-v1.glb'));
fs.writeFileSync(path.join(dir,'scanner-data.mjs'),`// Local Blender asset, see build-scanner-equipment.py and concept source.\nexport const sha256='${crypto.createHash('sha256').update(bytes).digest('hex')}';\nexport default '${bytes.toString('base64')}';\n`);
console.log(JSON.stringify({bytes:bytes.length}));
