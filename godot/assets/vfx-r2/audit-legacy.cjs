const fs=require('fs');
let report={};
for(const f of ['domain-gate','void-fracture','dao-gate']){
 let b=fs.readFileSync('godot/assets/ascension/'+f+'.glb');let j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
 let boxes=[];for(const m of j.meshes)for(const p of m.primitives){let a=j.accessors[p.attributes.POSITION];boxes.push({min:a.min,max:a.max,material:p.material})}
 report[f]={materials:j.materials.map(m=>({name:m.name,alphaMode:m.alphaMode||'OPAQUE',alpha:m.pbrMetallicRoughness?.baseColorFactor?.[3],doubleSided:m.doubleSided})),primitiveBounds:boxes};
}
fs.writeFileSync('godot/assets/vfx-r2/legacy-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
