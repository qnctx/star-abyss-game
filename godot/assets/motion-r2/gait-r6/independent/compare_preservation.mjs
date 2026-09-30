// Semantic GLB comparison independent of production exporters/checks.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const [beforeArg,afterArg,outArg]=process.argv.slice(2);
if(!beforeArg||!afterArg||!outArg) throw Error('Usage: node compare_preservation.mjs BEFORE.glb AFTER.glb REPORT.json');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const digest=x=>hash(JSON.stringify(canonical(x)));
function load(file) {
  const bytes=fs.readFileSync(file);let doc,bin;
  if(bytes.toString('ascii',0,4)!=='glTF')throw Error('Expected GLB');
  for(let p=12;p<bytes.length;) {const len=bytes.readUInt32LE(p),type=bytes.readUInt32LE(p+4);if(type===0x4e4f534a)doc=JSON.parse(bytes.toString('utf8',p+8,p+8+len).trim());if(type===0x004e4942)bin=bytes.subarray(p+8,p+8+len);p+=8+len;}
  const accessor=id=>{
    const a=doc.accessors[id];if(a.sparse)throw Error('Sparse accessor unsupported');
    const v=doc.bufferViews[a.bufferView],size={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[a.componentType],width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16}[a.type];
    const chunks=Array.from({length:a.count},(_,i)=>{const start=(v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??size*width);return bin.subarray(start,start+size*width);});
    return {type:a.type,componentType:a.componentType,normalized:a.normalized??false,count:a.count,data:hash(Buffer.concat(chunks))};
  };
  const animations=Object.fromEntries((doc.animations??[]).map(a=>[a.name,digest(a.channels.map(ch=>{
    const s=a.samplers[ch.sampler];return {node:doc.nodes[ch.target.node].name,path:ch.target.path,interpolation:s.interpolation??'LINEAR',input:accessor(s.input),output:accessor(s.output)};
  }).sort((a,b)=>(a.node+'/'+a.path).localeCompare(b.node+'/'+b.path)))]));
  const meshes=(doc.meshes??[]).map(m=>({name:m.name,primitives:m.primitives.map(p=>({mode:p.mode??4,material:p.material,indices:p.indices===undefined?null:accessor(p.indices),attributes:Object.fromEntries(Object.entries(p.attributes).map(([k,v])=>[k,accessor(v)])),targets:(p.targets??[]).map(t=>Object.fromEntries(Object.entries(t).map(([k,v])=>[k,accessor(v)])))}))}));
  const skins=(doc.skins??[]).map(s=>({name:s.name,joints:s.joints.map(i=>doc.nodes[i].name),skeleton:s.skeleton===undefined?null:doc.nodes[s.skeleton].name,inverseBinds:s.inverseBindMatrices===undefined?null:accessor(s.inverseBindMatrices)}));
  const nodes=doc.nodes.map(n=>({name:n.name,translation:n.translation??[0,0,0],rotation:n.rotation??[0,0,0,1],scale:n.scale??[1,1,1],matrix:n.matrix??null,mesh:n.mesh===undefined?null:doc.meshes[n.mesh].name,skin:n.skin===undefined?null:doc.skins[n.skin].name,children:(n.children??[]).map(i=>doc.nodes[i].name)})).sort((a,b)=>a.name.localeCompare(b.name));
  const images=(doc.images??[]).map(i=>{if(i.uri)return {uri:i.uri};const v=doc.bufferViews[i.bufferView];return {mimeType:i.mimeType,data:hash(bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength))};});
  return {path:path.resolve(file),sha256:hash(bytes),animations,meshes:digest(meshes),skins:digest(skins),nodes:digest(nodes),materials:digest(doc.materials??[]),textures:digest(doc.textures??[]),images:digest(images),counts:{animations:Object.keys(animations).length,meshes:meshes.length,skins:skins.length,nodes:nodes.length}};
}
const before=load(beforeArg),after=load(afterArg),allowed=new Set(['walk','jog','sprint']);
const allNames=[...new Set([...Object.keys(before.animations),...Object.keys(after.animations)])].sort();
const changed=allNames.filter(n=>before.animations[n]!==after.animations[n]);
const report={method:'Independent semantic GLB comparison of raw accessor elements (excluding padding), all mesh attributes/index/morph data, skin joint order/inverse bind matrices, node rest TRS/hierarchy, textures/materials/images, and named animation channel/sampler data.',before:{path:before.path,sha256:before.sha256,counts:before.counts},after:{path:after.path,sha256:after.sha256,counts:after.counts},changed_animations:changed,unexpected_animation_changes:changed.filter(n=>!allowed.has(n)),preserved:Object.fromEntries(['meshes','skins','nodes','materials','textures','images'].map(k=>[k,before[k]===after[k]])),missing_animations:Object.keys(before.animations).filter(n=>!after.animations[n]),added_animations:Object.keys(after.animations).filter(n=>!before.animations[n])};
report.passed=report.unexpected_animation_changes.length===0&&Object.values(report.preserved).every(Boolean)&&report.missing_animations.length===0&&report.added_animations.length===0;
fs.mkdirSync(path.dirname(path.resolve(outArg)),{recursive:true});fs.writeFileSync(outArg,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(!report.passed)process.exitCode=1;
