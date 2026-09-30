// Image-first references: docs/art/planet-v1/surface-transition-concept.png.
// THREE is injected by the host. Positions are local metres after floating-origin projection.
export const PLANET_ART_VERSION = 'planet-art-v1';
export const BIOME_IDS = ['basin','plains','mountains','forest','wetland','river','coast','ocean','cliff'];
export const MATERIALS = Object.freeze({
  basin: {color:'#746579',roughness:.96}, plains:{color:'#85816a',roughness:.95},
  mountains:{color:'#66616c',roughness:.94}, forest:{color:'#4b5949',roughness:1},
  wetland:{color:'#535a48',roughness:.7},river:{color:'#405966',roughness:.24},
  coast:{color:'#989087',roughness:.85},ocean:{color:'#263c57',roughness:.2},cliff:{color:'#726975',roughness:.93}
});
export function normalizeBiomes(weights) {
  const values=BIOME_IDS.map(id=>Number.isFinite(weights?.[id])?Math.max(0,weights[id]):0);
  const sum=values.reduce((a,b)=>a+b,0);
  return Object.fromEntries(BIOME_IDS.map((id,i)=>[id,sum?values[i]/sum:Number(id==='basin')]));
}
// Linear-space blending, no terrain displacement, no height or biome ownership.
export function sampleArtMaterial(THREE, weights) {
  const w=normalizeBiomes(weights),color=new THREE.Color(0,0,0); let roughness=0;
  for(const id of BIOME_IDS){color.add(new THREE.Color(MATERIALS[id].color).multiplyScalar(w[id]));roughness+=MATERIALS[id].roughness*w[id];}
  return {color,roughness,metalness:0};
}
function rng(seed) {let s=seed>>>0;return ()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function builder(THREE){
  const positions=[],colors=[];
  function tri(a,b,c,color){for(const p of [a,c,b]){positions.push(...p);colors.push(color.r,color.g,color.b);}}
  function tube(points,radii,color,sides=7){
    const rings=points.map((p,i)=>{const before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)];const tangent=new THREE.Vector3(...after).sub(new THREE.Vector3(...before)).normalize();const ref=Math.abs(tangent.y)>.9?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0);const u=new THREE.Vector3().crossVectors(tangent,ref).normalize(),v=new THREE.Vector3().crossVectors(tangent,u).normalize();return Array.from({length:sides},(_,j)=>{const a=j/sides*Math.PI*2;return new THREE.Vector3(...p).addScaledVector(u,Math.cos(a)*radii[i]).addScaledVector(v,Math.sin(a)*radii[i]).toArray();});});
    for(let i=1;i<rings.length;i++)for(let j=0;j<sides;j++){const k=(j+1)%sides;tri(rings[i-1][j],rings[i][j],rings[i][k],color);tri(rings[i-1][j],rings[i][k],rings[i-1][k],color);}
    for(let j=0;j<sides;j++){const k=(j+1)%sides;tri(points[0],rings[0][j],rings[0][k],color);tri(points.at(-1),rings.at(-1)[k],rings.at(-1)[j],color);}
  }
  function finish(){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingSphere();return g;}
  return {tri,tube,finish};
}
function tree(THREE,seed,lod){
  const b=builder(THREE),r=rng(seed),bark=new THREE.Color('#665b66');
  b.tube([[0,0,0],[.18,2,0],[-.15,4,.2],[.25,6,.12],[.1,8,.3]],[.42,.3,.23,.14,.025],bark);
  // Buttress roots and irregular, tapering branch paths follow reference panel 03.
  for(let k=0;k<5;k++){const a=k*1.256;b.tube([[Math.cos(a)*1.3,.03,Math.sin(a)*1.3],[Math.cos(a)*.55,.24,Math.sin(a)*.55],[0,1.25,0]],[.06,.19,.16],bark,5);}
  for(let k=0;k<(lod?7:12);k++){
    const a=k*2.399,h=3.4+k*.32,reach=1.7+r()*1.6;
    const end=[Math.cos(a)*reach,h+1.7,Math.sin(a)*reach];
    b.tube([[0,h,0],[end[0]*.5,h+.6,end[2]*.5],end],[.13,.085,.014],bark,5);
    // Dense individual folded leaf blades; no sphere/cone canopy stand-ins.
    for(let j=0;j<(lod?32:160);j++){
      const theta=r()*Math.PI*2,rad=Math.sqrt(r())*1.35;
      const p=[end[0]+Math.cos(theta)*rad,end[1]+(r()-.5)*1.4,end[2]+Math.sin(theta)*rad];
      const angle=r()*Math.PI*2,len=.28+r()*.28,w=len*.48;
      const tip=[p[0]+Math.cos(angle)*len,p[1]+.09,p[2]+Math.sin(angle)*len];
      const left=[p[0]-Math.sin(angle)*w,p[1]-.04,p[2]+Math.cos(angle)*w];
      const right=[p[0]+Math.sin(angle)*w,p[1]-.04,p[2]-Math.cos(angle)*w];
      const color=new THREE.Color().setHSL(.23+r()*.07,.13+r()*.1,.19+r()*.12);
      b.tri(p,left,tip,color);b.tri(p,tip,right,color);
    }
  }
  return b.finish();
}
function reeds(THREE,seed,lod){
  const b=builder(THREE),r=rng(seed);
  for(let k=0;k<(lod?8:18);k++){
    const a=r()*6.283,rad=Math.sqrt(r())*.7,x=Math.cos(a)*rad,z=Math.sin(a)*rad,h=.8+r()*1.3,bend=.12+r()*.2;
    b.tube([[x,0,z],[x+bend*.3,h*.55,z],[x+bend,h,z+.07]],[.016,.012,.004],new THREE.Color('#737650'),4);
    for(let j=0;j<3;j++){const y=h*(.2+j*.19),side=j%2?1:-1;
      b.tri([x,y,z],[x+side*.11,y+.2,z+.035],[x+side*(.3+r()*.2),y+.18,z+.12],new THREE.Color('#677451'));}
    b.tube([[x+bend*.85,h*.85,z+.055],[x+bend,h,z+.07]],[.037,.025],new THREE.Color('#726054'),5);
  }return b.finish();
}
function pebbles(THREE,seed,lod){
  const b=builder(THREE),r=rng(seed);
  for(let k=0;k<(lod?3:7);k++){
    const x=(r()-.5)*2,z=(r()-.5)*2,size=.12+r()*.26,rings=[];
    const n=lod?6:9;
    for(let i=0;i<=5;i++){const phi=i/5*Math.PI;const ring=[];for(let j=0;j<n;j++){const a=j/n*Math.PI*2,f=.88+r()*.2;ring.push([x+Math.sin(phi)*Math.cos(a)*size*f,Math.cos(phi)*size*.55+size*.42,z+Math.sin(phi)*Math.sin(a)*size*f]);}rings.push(ring);}
    const color=new THREE.Color().setHSL(.72,.05,.32+r()*.2);
    for(let i=1;i<rings.length;i++)for(let j=0;j<n;j++){const q=(j+1)%n;b.tri(rings[i-1][j],rings[i][j],rings[i][q],color);b.tri(rings[i-1][j],rings[i][q],rings[i-1][q],color);}
  }return b.finish();
}
export const ASSET_RULES=Object.freeze({
  tree:{biomes:['forest'],maxSlope:.55,maxWaterDepthM:0,spacingM:7,collision:'host-trunk-capsule',lodM:[90,260]},
  reed:{biomes:['wetland'],maxSlope:.18,maxWaterDepthM:.35,spacingM:1.5,collision:'none',lodM:[45,120]},
  pebble:{biomes:['river','coast'],maxSlope:.65,maxWaterDepthM:.2,spacingM:2,collision:'none-detail',lodM:[40,100]}
});
/** Candidate directions and IDs must come from persistent global cells, never camera position.
 * slope is radians. getWaterDepthM is authoritative water-surface minus ground, clamped >=0.
 * Returns render-local transforms, plus host collision capsules for trees.
 * Does not create candidates, alter terrain, or touch the preserved legacy basin.
 */
export function placePlanetArt({kind,field,candidates,origin,getWaterDepthM}){
  const rule=ASSET_RULES[kind];
  if(!rule||typeof getWaterDepthM!=='function')throw new TypeError('kind and authoritative getWaterDepthM required');
  if(!origin||![origin.x,origin.y,origin.z].every(Number.isFinite))throw new TypeError('finite double-precision origin required');
  const records=[],colliders=[];
  for(const candidate of candidates){
    const d=candidate.direction,s=field.sampleSurface(d),depth=getWaterDepthM(d,s);
    if(!Number.isFinite(depth)||depth<0||depth>rule.maxWaterDepthM||!Number.isFinite(s.slope)||s.slope>rule.maxSlope||s.legacyWeight>0)continue;
    const weights=normalizeBiomes(s.biomes),density=rule.biomes.reduce((sum,id)=>sum+weights[id],0);
    if(!Number.isSafeInteger(candidate.id))throw new TypeError('stable numeric candidate id required');
    const random=rng(candidate.id);if(random()>density)continue;
    const p=field.surfacePoint(d),length=Math.hypot(d.x,d.y,d.z);
    if(!length||![p.x,p.y,p.z].every(Number.isFinite))throw new TypeError('invalid field coordinate');
    const scale=.82+random()*.36;
    const record={position:[p.x-origin.x,p.y-origin.y,p.z-origin.z],up:[d.x/length,d.y/length,d.z/length],scale,yaw:random()*Math.PI*2};
    records.push(record);
    if(kind==='tree')colliders.push({id:candidate.id,base:{...p},up:record.up,radiusM:.43*scale,heightM:3.4*scale});
  }
  return {records,colliders};
}
/** records: {position:[x,y,z],up:[x,y,z],scale:positive,yaw:radians}.
 * Host selects deterministic sites from authoritative biome/water data; never use camera RNG.
 * Each batch owns its resources. Call dispose when its streaming cell retires.
 */
export function createPlanetArtBatch(THREE,{kind,records,seed=190916,lod=0}){
  if(!ASSET_RULES[kind])throw new TypeError('Unknown planet art kind');
  if(!Array.isArray(records))throw new TypeError('records must be an array');
  for(const rec of records){if(!Array.isArray(rec.position)||rec.position.length!==3||!rec.position.every(Number.isFinite)||!Array.isArray(rec.up)||rec.up.length!==3||!rec.up.every(Number.isFinite)||Math.hypot(...rec.up)<1e-8||!(Number.isFinite(rec.scale)&&rec.scale>0)||!Number.isFinite(rec.yaw))throw new TypeError('Invalid local instance transform');}
  const geometry=({tree,reed:reeds,pebble:pebbles})[kind](THREE,seed,lod);
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:kind==='pebble'?.83:.96,metalness:0,side:THREE.DoubleSide});
  const mesh=new THREE.InstancedMesh(geometry,material,records.length),matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),spin=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0);
  records.forEach((rec,i)=>{q.setFromUnitVectors(axis,new THREE.Vector3(...rec.up).normalize());spin.setFromAxisAngle(axis,rec.yaw);q.multiply(spin);matrix.compose(new THREE.Vector3(...rec.position),q,new THREE.Vector3().setScalar(rec.scale));mesh.setMatrixAt(i,matrix);});
  mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=kind==='tree';mesh.receiveShadow=true;mesh.computeBoundingSphere();
  mesh.userData={planetArt:PLANET_ART_VERSION,kind,seed,lod,reference:'docs/art/planet-v1/surface-transition-concept.png',collision:ASSET_RULES[kind].collision};
  return {mesh,dispose(){geometry.dispose();material.dispose();}};
}
