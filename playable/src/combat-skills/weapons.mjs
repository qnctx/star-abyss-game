import * as THREE from 'three';
// Hand-authored bevelled blade outlines, distinct hilt/guard/inlay silhouettes.
// These are first-pass concept-derived assets, not final art acceptance.
export function createSkillWeapon(kind){
 const root=new THREE.Group();root.name=`combat-${kind}-v001`;
 const steel=new THREE.MeshStandardMaterial({color:0xc5d6dd,metalness:.82,roughness:.26});
 const dark=new THREE.MeshStandardMaterial({color:0x17232f,metalness:.55,roughness:.5});
 const gold=new THREE.MeshStandardMaterial({color:0xb79955,metalness:.75,roughness:.28});
 const glow=new THREE.MeshStandardMaterial({color:kind==='saber'?0x56dcff:0xe3dca4,emissive:kind==='saber'?0x258daa:0x6d5f2c,emissiveIntensity:.4,metalness:.6,roughness:.3});
 function plate(name,points,depth,mat,z=0){const s=new THREE.Shape();s.moveTo(...points[0]);for(const p of points.slice(1))s.lineTo(...p);s.closePath();const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.006,bevelThickness:.004}),mat);mesh.name=name;mesh.position.z=z;root.add(mesh);return mesh;}
 plate('wrapped-grip',[[-.023,-.25],[.023,-.25],[.028,0],[-.028,0]],.045,dark,-.0225);
 for(let i=0;i<7;i++)plate(`grip-binding-${i}`,[[-.025,-.24+i*.033],[.025,-.23+i*.033],[.025,-.222+i*.033],[-.025,-.232+i*.033]],.047,gold,-.0235);
 plate('pommel',[[-.035,-.29],[0,-.32],[.035,-.29],[.03,-.245],[-.03,-.245]],.055,gold,-.0275);
 plate('swept-guard',[[-.16,.01],[-.12,.055],[-.035,.025],[.035,.025],[.12,.055],[.16,.01],[.035,-.015],[-.035,-.015]],.065,gold,-.0325);
 if(kind==='saber'){
  plate('curved-single-edge',[[-.045,.03],[-.04,.35],[-.005,.75],[.08,1.14],[.23,1.44],[.1,1.29],[-.035,1.03],[-.12,.7],[-.145,.3],[-.105,.03]],.024,steel,-.012);
  plate('water-channel',[[-.075,.08],[-.07,.43],[-.018,.86],[.095,1.18],[.062,1.16],[-.041,.86],[-.09,.43],[-.09,.08]],.027,glow,-.0135);
 }else{
  plate('double-edge',[[-.047,.03],[-.045,1.12],[0,1.46],[.045,1.12],[.047,.03]],.022,steel,-.011);
  plate('star-ridge',[[-.008,.07],[-.007,1.16],[0,1.38],[.007,1.16],[.008,.07]],.03,glow,-.015);
 }
 // Native C2 wrists point down local -Y; align the blade with the extended
 // forearm, not local -Z (which pitched the weapon vertically on release).
 root.rotation.z=Math.PI;root.position.set(0,-.11,-.035);return root;
}
