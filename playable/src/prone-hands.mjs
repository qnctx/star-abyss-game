import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
// Relaxed, open five-finger gloves for elbow-supported crawling. The character
// source has no finger bones and clenched hands, so these attach to its wrists.
export function createProneHand(side,materials){
 const root=new THREE.Group();root.name=side<0?'prone-open-hand-L':'prone-open-hand-R';
 const glove=new THREE.MeshStandardMaterial({color:'#494239',roughness:.94}),seam=new THREE.MeshStandardMaterial({color:'#776650',roughness:.85});materials.push(glove,seam);
 const parts=[];
 function mesh(g,m,p){const o=new THREE.Mesh(g,m);o.position.set(...p);root.add(o);parts.push(o);return o;}
 function ball(p,s,m=glove){const o=mesh(new THREE.SphereGeometry(1,12,8),m,p);o.scale.set(...s);}
 function bone(a,b,r,m=glove){const x=new THREE.Vector3(...a),y=new THREE.Vector3(...b),d=y.clone().sub(x);const o=mesh(new THREE.CapsuleGeometry(r,Math.max(0,d.length()-2*r),3,8),m,x.add(y).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());}
 bone([0,0,0],[0,-.04,.026],.027);ball([0,-.053,.031],[.042,.050,.022]);ball([0,-.05,.006],[.030,.033,.008],seam);
 for(let f=0;f<4;f++){
  const x=(f-1.5)*.021,len=[.062,.071,.067,.050][f];
  const points=[[x,-.087,.036],[x*1.10,-.087-len*.42,.049],[x*1.18,-.087-len*.78,.062],[x*1.22,-.087-len,.067]];
  for(let j=0;j<3;j++)bone(points[j],points[j+1],.008-j*.0006);
  ball(points[1],[.0085,.006,.0085]);
 }
 const thumb=-side;bone([thumb*.030,-.027,.025],[thumb*.059,-.050,.044],.012);bone([thumb*.059,-.050,.044],[thumb*.073,-.082,.061],.010);
 for(const m of [glove,seam]){const gs=[];for(const o of parts.filter(o=>o.material===m)){o.updateMatrix();const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrix);gs.push(g);o.removeFromParent();o.geometry.dispose();}const g=mergeGeometries(gs,false);gs.forEach(g=>g.dispose());root.add(new THREE.Mesh(g,m));}
 return root;
}
