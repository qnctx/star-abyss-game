import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {VEHICLE_RIG,steeringAngle} from './vehicle-rig.mjs';

// This assembly is part of the world vehicle in BOTH views, not a screen overlay.
export function createVehicleCockpit(materials){
 const root=new THREE.Group();root.name='skimmer-cockpit';
 const mat=o=>{const m=new THREE.MeshStandardMaterial(o);materials.push(m);return m;};
 const shell=mat({color:'#c6bda5',roughness:.6,metalness:.25}),gold=mat({color:'#998259',roughness:.45,metalness:.72});
 const dark=mat({color:'#172022',roughness:.8}),rubber=mat({color:'#242521',roughness:.95}),cloth=mat({color:'#4a3d2e',roughness:1});
 const leather=mat({color:'#34332c',roughness:.9}),seam=mat({color:'#74634b',roughness:.9});
 const amber=mat({color:'#ddb16c',emissive:'#a66722',emissiveIntensity:.5});
 const weave=document.createElement('canvas');weave.width=weave.height=128;const w=weave.getContext('2d');w.fillStyle='#ab9b83';w.fillRect(0,0,128,128);
 for(let i=0;i<128;i+=4){w.fillStyle=i%8?'#776d5f':'#c2b298';w.fillRect(i,0,1,128);w.fillRect(0,i,128,1);}
 const weaveMap=new THREE.CanvasTexture(weave);weaveMap.colorSpace=THREE.SRGBColorSpace;weaveMap.wrapS=weaveMap.wrapT=THREE.RepeatWrapping;weaveMap.repeat.set(3,3);cloth.map=weaveMap;leather.map=weaveMap;
 function mesh(g,m,parent,p=[0,0,0]){const o=new THREE.Mesh(g,m);o.position.set(...p);o.castShadow=false;o.receiveShadow=true;parent.add(o);return o;}
 const box=(s,p,m,parent=root,r=.01)=>mesh(new RoundedBoxGeometry(...s,3,r),m,parent,p);
 function rod(a,b,r,m,parent=root){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),d=vb.clone().sub(va);const o=mesh(new THREE.CapsuleGeometry(r,Math.max(0,d.length()-r*2),3,10),m,parent,va.add(vb).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o;}
 const steering=new THREE.Group();steering.name='steering-and-grips';steering.position.set(...VEHICLE_RIG.steering);root.add(steering);
 rod([0,.74,-.5],[0,1.19,-.48],.035,dark);
 box([.115,.06,.10],[0,.005,0],gold,steering);

 for(const side of [-1,1]){
  rod([0,0,0],[side*.22,.04,.01],.022,gold,steering);
  rod([side*.21,.04,.01],[side*.38,.035,.03],.027,rubber,steering);
  for(let i=0;i<9;i++){const ring=mesh(new THREE.TorusGeometry(.028,.0016,5,16),leather,steering,[side*(.24+i*.014),.038,.02]);ring.rotation.y=Math.PI/2;}
  box([.045,.045,.055],[side*.205,.04,.005],dark,steering,.009);
  box([.019,.012,.022],[side*.205,.067,.005],amber,steering,.004);
  rod([side*.21,.02,-.035],[side*.37,.01,-.055],.007,gold,steering);
  // Low, ivory instrument cheeks echo the existing side pontoons.
  const cheek=box([.075,.09,.34],[side*.23,.99,-.62],shell);cheek.rotation.z=side*-.15;
  rod([side*.21,1.03,-.78],[side*.21,1.05,-.47],.002,gold);

 }
 const panel=new THREE.Group();panel.name='live-dashboard';panel.position.set(0,1.255,-.49);panel.rotation.x=-.60;panel.scale.set(.85,.95,1);root.add(panel);
 function plate(s,p,m,r){const x=s[0]/2,y=s[1]/2,shape=new THREE.Shape();shape.moveTo(-x+r,-y);shape.lineTo(x-r,-y);shape.quadraticCurveTo(x,-y,x,-y+r);shape.lineTo(x,y-r);shape.quadraticCurveTo(x,y,x-r,y);shape.lineTo(-x+r,y);shape.quadraticCurveTo(-x,y,-x,y-r);shape.lineTo(-x,-y+r);shape.quadraticCurveTo(-x,-y,-x+r,-y);return mesh(new THREE.ExtrudeGeometry(shape,{depth:s[2],bevelEnabled:false,curveSegments:8}),m,panel,p);}
 plate([.405,.222,.072],[0,0,-.036],dark,.036);plate([.39,.209,.012],[0,0,.035],gold,.035);plate([.375,.193,.012],[0,0,.043],shell,.033);
 plate([.323,.144,.011],[0,.011,.052],dark,.018);
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=384;const ctx=canvas.getContext('2d');const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
 const screenMat=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});materials.push(screenMat);
 mesh(new THREE.PlaneGeometry(.305,.128),screenMat,panel,[0,.013,.065]);
 for(const side of [-1,1]){box([.018,.010,.010],[side*.13,-.078,.058],amber,panel,.003);mesh(new THREE.SphereGeometry(.003,8,6),dark,panel,[side*.173,.074,.058]);}
 for(const group of [steering]){
  const batches=new Map();for(const o of [...group.children])if(o.isMesh){o.updateMatrix();const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrix);if(!batches.has(o.material))batches.set(o.material,[]);batches.get(o.material).push(g);group.remove(o);o.geometry.dispose();}
  for(const [m,gs]of batches){mesh(mergeGeometries(gs,false),m,group);gs.forEach(g=>g.dispose());}
 }
 let key='',angle=0,state={speed:0,battery:100,braking:false,firstPerson:false,steering:0};
 function update(vehicle,view={}){
  state={speed:Math.hypot(view.vx||0,view.vz||0),battery:Math.max(0,Math.min(100,vehicle.battery??100)),braking:!!view.controls?.lift,firstPerson:!!view.firstPerson,steering:0};
  angle=steeringAngle(view.controls);steering.rotation.y=angle;
  state.steering=angle;
  const next=[Math.round(state.speed*10),Math.floor(state.battery),state.braking,!!vehicle.repaired].join(':');if(next===key)return;key=next;
  ctx.fillStyle='#07181b';ctx.fillRect(0,0,768,384);ctx.strokeStyle='#305154';ctx.lineWidth=3;ctx.strokeRect(12,12,744,360);
  ctx.fillStyle='#8ba9a5';ctx.font='24px sans-serif';ctx.fillText('XUNJI / SURVEY',38,53);ctx.fillText('BATTERY',455,105);
  ctx.fillStyle='#b3f2ee';ctx.font='bold 130px monospace';ctx.fillText(state.speed.toFixed(1).padStart(4,'0'),32,202);
  ctx.font='30px sans-serif';ctx.fillText('m/s',310,252);ctx.font='bold 68px monospace';ctx.fillText(Math.floor(state.battery)+'%',451,195);
  ctx.fillStyle='#1a373a';ctx.fillRect(453,223,263,20);ctx.fillStyle=state.battery<20?'#e5af5f':'#6ed4cc';ctx.fillRect(453,223,263*state.battery/100,20);
  ctx.fillStyle='#c8a668';ctx.font='30px monospace';ctx.fillText(!vehicle.repaired?'OFFLINE':state.braking?'BRAKE':state.speed>.2?'DRIVE':'READY',40,331);ctx.font='24px monospace';ctx.fillText('V / VIEW',525,331);texture.needsUpdate=true;
 }
 update({battery:100,repaired:false});
 return {root,update,snapshot:()=>({...state,handsVisible:false,riderHands:'shared-character-skeleton',dashboard:'live world-space',eyeSource:'mounted-character-head'}),dispose:()=>{texture.dispose();weaveMap.dispose();}};
}
