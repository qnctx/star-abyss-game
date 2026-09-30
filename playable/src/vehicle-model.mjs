import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrainHeight } from './layout.mjs';
import {createVehicleCockpit} from './vehicle-cockpit.mjs';
import {VEHICLE_RIG} from './vehicle-rig.mjs';

// 巡迹勘探车: a compact single-rider field machine, with a footprint inside its 1.1 m collider.
export function createSkimmer(materials) {
  const root=new THREE.Group(),hull=new THREE.Group(),pickup=new THREE.Group();
  root.name='survey-skimmer';pickup.name='skimmer-coupler-cache';root.add(hull);
  const mat=options=>{const m=new THREE.MeshStandardMaterial(options);materials.push(m);return m;};
  const graphite=mat({color:'#29353a',roughness:.72,metalness:.56});
  const ceramic=mat({color:'#b8b4a4',roughness:.66,metalness:.30});
  const edge=mat({color:'#787866',roughness:.52,metalness:.75});
  const dark=mat({color:'#101c22',roughness:.85,metalness:.18});
  const amber=mat({color:'#cba668',emissive:'#976529',emissiveIntensity:.9,roughness:.4});
  const energy=mat({color:'#7fe6e8',emissive:'#269aaa',emissiveIntensity:1.8,roughness:.3});
  const glass=mat({color:'#072d36',emissive:'#124657',emissiveIntensity:.8,roughness:.2,metalness:.5});
  const mesh=(geometry,material,parent,x=0,y=0,z=0)=>{const item=new THREE.Mesh(geometry,material);item.position.set(x,y,z);item.receiveShadow=true;parent.add(item);return item;};
  const ellipsoid=(x,y,z,rx,ry,rz,material,parent=hull)=>{const item=mesh(new THREE.SphereGeometry(1,24,14),material,parent,x,y,z);item.scale.set(rx,ry,rz);return item;};
  const tube=(points,radius,material,parent=hull)=>mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),22,radius,7,false),material,parent);
  const lightAssembly=new THREE.Group();hull.add(lightAssembly);
  ellipsoid(0,.54,0,.29,.18,.87,graphite);
  ellipsoid(0,.66,-.53,.28,.18,.50,ceramic);
  ellipsoid(0,.81,.20,.20,.085,.40,dark);
  ellipsoid(0,.93,.13,.16,.045,.31,dark);
  ellipsoid(0,.61,.68,.24,.17,.27,ceramic);
  for(const side of [-1,1]) {
    // Split suspension and independently visible anti-gravity pads clarify how it travels.
    tube([[side*.15,.54,-.49],[side*.40,.43,-.49],[side*.62,.36,-.48]],.055,edge);
    tube([[side*.15,.54,.46],[side*.42,.43,.46],[side*.62,.36,.43]],.055,edge);
    ellipsoid(side*.62,.34,-.03,.235,.16,.69,graphite);
    ellipsoid(side*.62,.43,-.07,.21,.10,.63,ceramic);
    for(const z of [-.45,.40]) {
      const pad=mesh(new THREE.CylinderGeometry(.215,.22,.075,22),dark,hull,side*.62,.21,z);pad.scale.z=1.18;
      const rim=mesh(new THREE.TorusGeometry(.172,.012,5,28),energy,lightAssembly,side*.62,.164,z);rim.rotation.x=Math.PI/2;rim.scale.y=1.15;
      const underside=mesh(new THREE.CircleGeometry(.16,24),energy,lightAssembly,side*.62,.167,z);underside.rotation.x=Math.PI/2;
    }
    tube([[side*.20,.57,.12],[side*.40,.54,.07],[side*.42,.51,-.28]],.027,edge);
    ellipsoid(side*.41,.53,-.23,.105,.032,.20,dark);
    tube([[side*.19,.76,-.71],[side*.13,.72,-.95],[side*.05,.66,-1.015]],.012,energy,lightAssembly);
    tube([[side*.17,.69,.85],[side*.11,.71,.91]],.020,amber);
    for(let i=0;i<5;i++)tube([[side*.74,.446,-.32+i*.13],[side*.55,.45,-.27+i*.13]],.008,graphite);
  }
  const cockpit=createVehicleCockpit(materials);hull.add(cockpit.root);
  // Open rear maintenance socket is visible before the coupler is fitted.
  const socket=mesh(new THREE.CylinderGeometry(.081,.081,.14,14),dark,hull,0,.74,.73);socket.rotation.x=Math.PI/2;
  const fitted=new THREE.Group();hull.add(fitted);
  mesh(new THREE.CylinderGeometry(.059,.059,.13,14),amber,fitted,0,.74,.74).rotation.x=Math.PI/2;
  mesh(new THREE.TorusGeometry(.085,.015,5,20),edge,hull,0,.74,.81);

  pickup.position.set(98,terrainHeight(98,62),62);
  const caseShape=new THREE.Shape();caseShape.moveTo(-.38,-.23);caseShape.lineTo(.38,-.23);caseShape.lineTo(.43,.12);caseShape.lineTo(.25,.25);caseShape.lineTo(-.25,.25);caseShape.lineTo(-.43,.12);caseShape.closePath();
  const caseGeometry=new THREE.ExtrudeGeometry(caseShape,{depth:.34,bevelEnabled:true,bevelSize:.035,bevelThickness:.025,bevelSegments:2,steps:1});caseGeometry.rotateX(-Math.PI/2);caseGeometry.translate(0,.035,0);
  mesh(caseGeometry,graphite,pickup);
  for(const side of [-1,1])tube([[side*.29,.39,-.16],[side*.29,.40,.10]],.022,edge,pickup);
  const lid=ellipsoid(0,.21,-.32,.43,.24,.045,ceramic,pickup);lid.rotation.x=-.48;
  const coupler=new THREE.Group();pickup.add(coupler);
  mesh(new THREE.CylinderGeometry(.075,.075,.26,16),amber,coupler,0,.48,0).rotation.z=Math.PI/2;
  for(const x of [-.15,.15])mesh(new THREE.CylinderGeometry(.088,.088,.055,14),edge,coupler,x,.48,0).rotation.z=Math.PI/2;
  mesh(new THREE.TorusGeometry(.078,.008,6,20),energy,coupler,.045,.48,0).rotation.y=Math.PI/2;

  // Immutable body pieces are batched. Lights and repair payload retain independent visibility.
  for(const group of [hull,lightAssembly,pickup,coupler,fitted]) {
    const batches=new Map();
    for(const item of [...group.children])if(item.isMesh){item.updateMatrix();const geometry=item.geometry.index?item.geometry.toNonIndexed():item.geometry.clone();geometry.applyMatrix4(item.matrix);if(!batches.has(item.material))batches.set(item.material,[]);batches.get(item.material).push(geometry);group.remove(item);item.geometry.dispose();}
    for(const [material,geometries] of batches){const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());if(geometry)mesh(geometry,material,group);}
  }
  const shadowGeometry=new THREE.PlaneGeometry(2.5,2.8,8,8);shadowGeometry.rotateX(-Math.PI/2);
  const shadowMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
    vertexShader:'varying vec2 p;void main(){p=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 p;void main(){vec2 q=p*vec2(1.0,.8);float a=exp(-dot(q,q)*2.8)*.38;gl_FragColor=vec4(.007,.012,.016,a);}'});materials.push(shadowMat);
  const shadow=mesh(shadowGeometry,shadowMat,root);shadow.renderOrder=1;
  return {root,pickup,cockpitSnapshot:cockpit.snapshot,dispose:cockpit.dispose,update(vehicle={},time=0,view={}) {
    const x=Number.isFinite(vehicle.x)?vehicle.x:72,z=Number.isFinite(vehicle.z)?vehicle.z:80,yaw=vehicle.yaw||0,ground=Number.isFinite(vehicle.y)?vehicle.y:terrainHeight(x,z);
    root.position.set(x,ground,z);root.rotation.set(0,yaw,0);
    if(vehicle.surfaceNormal&&!view.radialGround){
      const up=new THREE.Vector3(vehicle.surfaceNormal.x,vehicle.surfaceNormal.y,vehicle.surfaceNormal.z).normalize(),forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
      forward.addScaledVector(up,-forward.dot(up)).normalize();
      const right=new THREE.Vector3().crossVectors(forward,up).normalize();
      root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,forward.negate()));
    }
    hull.position.y=vehicle.repaired?VEHICLE_RIG.hullLift:0;hull.rotation.z=vehicle.repaired?0:-.10;
    cockpit.update(vehicle,view);
    lightAssembly.visible=!!vehicle.repaired&&vehicle.battery>0;fitted.visible=!!vehicle.repaired;coupler.visible=!vehicle.partTaken;
    energy.emissiveIntensity=vehicle.mounted?1.9:1.2;amber.emissiveIntensity=vehicle.repaired?.65:.40+Math.sin(time*2)*.18;
    shadow.visible=vehicle.grounded!==false;shadow.quaternion.copy(root.quaternion).invert();
    const p=shadowGeometry.attributes.position;
    for(let i=0;i<p.count;i++){const lx=p.getX(i),lz=p.getZ(i);p.setY(i,view.radialGround?-.037:terrainHeight(x+lx,z+lz)-ground+.012);}p.needsUpdate=true;
  }};
}
