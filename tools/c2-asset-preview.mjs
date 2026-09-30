import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const canvas=document.querySelector('canvas');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setSize(1600,1000,false);
renderer.setPixelRatio(1);
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.1;
const scene=new THREE.Scene();scene.background=new THREE.Color('#353b3d');
scene.add(new THREE.HemisphereLight('#fff4e3','#4c5256',2.4));
for(const [pos,power,color] of [[[-3,5,4],3.2,'#ffe6cc'],[[4,3,-3],2,'#d7e9ff']]){
 const light=new THREE.DirectionalLight(color,power);light.position.set(...pos);scene.add(light);
}
const camera=new THREE.PerspectiveCamera(34,.8,.01,100);
let loaded=null;
function render(){
 renderer.setScissorTest(true);
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4;
  camera.position.set(Math.sin(a)*3.7,1.04,Math.cos(a)*3.7);camera.lookAt(0,.93,0);
  renderer.setViewport(i%4*400,i<4?500:0,400,500);
  renderer.setScissor(i%4*400,i<4?500:0,400,500);
  renderer.render(scene,camera);
 }
 renderer.setScissorTest(false);
}
const source=new URLSearchParams(location.search).get('model')||'c2-source_glb.glb';
new GLTFLoader().load(source,gltf=>{
 loaded=gltf.scene;
 if(new URLSearchParams(location.search).has('clay'))loaded.traverse(o=>{if(o.isMesh)o.material=new THREE.MeshStandardMaterial({color:0xaaaaaa,roughness:.8,side:THREE.DoubleSide});});
 const bounds=new THREE.Box3().setFromObject(loaded),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 const scale=1.85/size.y;
 loaded.scale.multiplyScalar(scale);loaded.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
 scene.add(loaded);
 let triangles=0,meshes=0,skins=0,materials=new Set();
 loaded.traverse(o=>{if(o.isMesh){meshes++;if(o.isSkinnedMesh)skins++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
  for(const mat of Array.isArray(o.material)?o.material:[o.material]) materials.add(mat.uuid);}});
 const report={source,meshes,skins,triangles,materials:materials.size,sourceDimensions:size.toArray(),animations:gltf.animations.map(a=>a.name)};
 document.querySelector('#status').textContent=`真实 GLB · ${Math.round(triangles).toLocaleString()} 三角 · ${skins} 个蒙皮网格`;
 window.c2AssetPreview={ready:true,report,render,model:loaded,renderer,scene,camera};
 render();
},undefined,error=>{document.querySelector('#status').textContent='模型加载失败';window.c2AssetPreview={ready:false,error:String(error)};});
