import fs from 'node:fs';import assert from 'node:assert/strict';
const dir=new URL('../../../playable/assets/creatures/riftwing-r11/',import.meta.url),bytes=fs.readFileSync(new URL('riftwing-r11.glb',dir));
const g=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
const expected=['ground-idle','ground-walk','ground-claw','takeoff','flight','dive','sweep','land','hit','death'];
const animations=g.animations.map(a=>({name:a.name,channels:a.channels.length,samples:a.samplers.length,duration:Math.max(...a.samplers.map(s=>g.accessors[s.input].max?.[0]||0))}));
for(const name of expected)assert(animations.some(a=>a.name===name),`Missing ${name}: ${animations.map(a=>a.name)}`);
let tris=0,primitives=0;for(const mesh of g.meshes)for(const p of mesh.primitives){tris+=g.accessors[p.indices].count/3;primitives++;assert(p.attributes.JOINTS_0!==undefined&&p.attributes.WEIGHTS_0!==undefined);}
assert(tris<55000);assert(g.skins.some(s=>s.joints.length>=24));
const report={triangles:tris,primitives,materials:g.materials.length,skins:g.skins.length,bones:g.skins.map(s=>s.joints.length),animations,bytes:bytes.length};
fs.writeFileSync(new URL('../../../docs/art/creatures/riftwing-r11/glb-verification.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
