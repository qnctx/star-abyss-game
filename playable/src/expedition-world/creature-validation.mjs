import {Matrix4,Vector3} from 'three';

const EXPECTED_SHA='39c6cc6ddafd84f9d269026618dec68f69eb6038bbd7810245a3376f22caf879';
const fail=message=>{throw Error('Creature rig validation: '+message);};
const finite=values=>values.every(Number.isFinite);

/** Validate before any actor is cloned, even when the menu has never supplied a view. */
export function validateCreatureTemplate(gltf,rig){
  const scene=gltf?.scene;if(!scene?.traverse)fail('missing scene');
  if(rig.assetSha256!==EXPECTED_SHA||rig.meshIndex!==0||rig.primitiveIndex!==0)fail('unrecognized index binding');
  const names=new Map(),meshes=[],allBones=[];
  scene.traverse(o=>{const list=names.get(o.name)??[];list.push(o);names.set(o.name,list);if(o.isMesh)meshes.push(o);if(o.isBone)allBones.push(o);
    if(!finite([...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()])||o.scale.toArray().some(s=>s<=0))fail('invalid transform '+o.name);
  });
  const unique=(name,bone=false)=>{const matches=names.get(name);if(matches?.length!==1||bone&&!matches[0].isBone)fail('missing/duplicate/wrong-type node '+name);return matches[0];};
  if(meshes.length!==1||!meshes[0].isSkinnedMesh||meshes[0]!==unique(rig.mesh))fail('expected one named skinned primitive');
  const mesh=meshes[0],skeleton=mesh.skeleton,g=mesh.geometry;
  const association=gltf.parser?.associations?.get(mesh);
  if(!association||association.meshes!==rig.meshIndex||association.primitives!==rig.primitiveIndex)fail('mesh/primitive index binding');
  const body=[rig.root,...rig.body],legs=Object.entries(rig.legs);
  if(body.join(',')!=='Root,Pelvis,Spine,Chest,Neck,Head'||rig.tail.join(',')!=='Tail01,Tail02'||legs.map(([n])=>n).join(',')!=='LF,RF,LH,RH')fail('unsupported rig-map schema');
  const required=[...body,...rig.tail,...legs.flatMap(([,l])=>l.chain)];required.forEach(n=>unique(n,true));
  if(required.length!==20||new Set(required).size!==20||allBones.length!==20||skeleton?.bones.length!==20||new Set(skeleton.bones).size!==20||required.some(n=>!skeleton.bones.includes(unique(n,true))))fail('skin skeleton membership');
  const parent=(child,wanted)=>{if(unique(child).parent!==unique(wanted))fail('parent chain '+child+' -> '+wanted);};
  body.slice(1).forEach((n,i)=>parent(n,body[i]));parent(rig.tail[0],'Pelvis');parent(rig.tail[1],rig.tail[0]);
  const positions=g.attributes.position,indices=g.attributes.skinIndex,weights=g.attributes.skinWeight;
  if(positions?.count!==43002||positions.itemSize!==3||indices?.count!==positions.count||indices.itemSize!==4||weights?.count!==positions.count||weights.itemSize!==4||g.index?.count!==35967*3)fail('geometry/skin accessor shape');
  for(let i=0;i<positions.count;i++){
    if(!finite([positions.getX(i),positions.getY(i),positions.getZ(i)]))fail('non-finite POSITION');
    let sum=0;for(let j=0;j<4;j++){const index=indices.getComponent(i,j),weight=weights.getComponent(i,j);if(!Number.isInteger(index)||index<0||index>=20||!Number.isFinite(weight)||weight<0||weight>1)fail('invalid skin index/weight');sum+=weight;}
    if(Math.abs(sum-1)>.002)fail('unnormalized skin weights');
  }
  for(let i=0;i<g.index.count;i++){const n=g.index.getX(i);if(!Number.isInteger(n)||n<0||n>=positions.count)fail('triangle index range');}
  const matrices=[mesh.bindMatrix,mesh.bindMatrixInverse,...(skeleton.boneInverses??[])];
  if(skeleton.boneInverses.length!==20||matrices.some(m=>!m?.elements||!finite(m.elements)||Math.abs(m.determinant())<1e-9))fail('invalid bind matrices');
  // Asset-specific rest-space invariant, not a rule for arbitrary glTF assets.
  // Frozen GLB Float32 inverse binds have max residual 6.35e-7; 1e-5 allows
  // numeric roundoff while rejecting inconsistent transforms. Never repair binds.
  const product=new Matrix4(),identityError=m=>Math.max(...m.elements.map((v,i)=>Math.abs(v-(i%5===0?1:0))));
  if(identityError(product.multiplyMatrices(mesh.bindMatrix,mesh.bindMatrixInverse))>1e-5)fail('inconsistent mesh bind pair');
  // Check the supplied pair before updateMatrixWorld can refresh bindMatrixInverse.
  scene.updateMatrixWorld(true);
  for(let i=0;i<skeleton.bones.length;i++)if(identityError(product.multiplyMatrices(skeleton.bones[i].matrixWorld,skeleton.boneInverses[i]))>1e-5)fail('inconsistent rest bind '+skeleton.bones[i].name);
  const point=new Vector3();
  for(const [name,leg]of legs){
    if(leg.chain.length!==3)fail('leg chain length '+name);
    parent(leg.chain[0],name.endsWith('F')?'Chest':'Pelvis');parent(leg.chain[1],leg.chain[0]);parent(leg.chain[2],leg.chain[1]);parent(leg.soleNode,leg.chain[2]);
    for(const [i,rest]of [leg.restHip,leg.restKnee,leg.restAnkle].entries()){if(!Array.isArray(rest)||rest.length!==3||!finite(rest)||unique(leg.chain[i]).getWorldPosition(point).distanceTo(new Vector3(...rest))>.002)fail('rest chain position '+name);}
    if(!finite(leg.poleDirection)||new Vector3(...leg.poleDirection).length()<.5)fail('invalid leg pole '+name);
    const sole=leg.soleVertexIndices,expected={LF:336,RF:334,LH:418,RH:434}[name];
    if(!Array.isArray(sole)||sole.length!==expected||new Set(sole).size!==sole.length)fail('sole group shape '+name);
    const own=new Set(leg.chain.map(n=>skeleton.bones.indexOf(unique(n))));
    for(const i of sole){if(!Number.isInteger(i)||i<0||i>=positions.count)fail('sole index range '+name);let weight=0;for(let j=0;j<4;j++)if(own.has(indices.getComponent(i,j)))weight+=weights.getComponent(i,j);if(weight<.98)fail('sole vertices bound to wrong leg '+name);}
  }
  if(!mesh.material||!g.attributes.uv)fail('missing material/UV');
  return mesh;
}

/** Bytes and rig-map indices are an inseparable asset version. No extra network request. */
export async function validateCreatureBytes(buffer){
  if(buffer.byteLength!==9029072)fail('asset byte length');
  const digest=await globalThis.crypto.subtle.digest('SHA-256',buffer);
  const sha=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
  if(sha!==EXPECTED_SHA)fail('asset SHA256 does not match sole index binding');
}
