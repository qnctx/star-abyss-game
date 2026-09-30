import * as THREE from 'three';
import {createAvatar} from '../src/avatar.mjs';
import {createGait,updateGait,gaitView} from '../src/gait.mjs';
import {createPlayer,movePlayer} from '../src/movement.mjs';
const canvas=document.querySelector('canvas');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setSize(1600,900,false);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
const scene=new THREE.Scene();scene.background=new THREE.Color('#333635');
scene.add(new THREE.HemisphereLight('#fff5df','#6b726a',2));
for(const [color,intensity,position] of [['#ffebce',3,[-3,5,-3]],['#b5dced',1.7,[3,3,4]]]){
 const light=new THREE.DirectionalLight(color,intensity);light.position.set(...position);scene.add(light);
}
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#525851',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.035;scene.add(floor);
const candidate=new URLSearchParams(location.search).get('model');
const materials=[],avatar=createAvatar(materials,candidate?{assetUrl:candidate}:{});scene.add(avatar.root);
const camera=new THREE.PerspectiveCamera(35,400/450,.03,100);
let player,gait,mode='idle',time=0;
const controls={idle:{},walk:{forward:true,walk:true},back:{backward:true,walk:true},left:{left:true,walk:true},right:{right:true,walk:true},run:{forward:true,sprint:true}};
function reset(next='idle'){
 mode=next;player={...createPlayer(),x:0,z:0,y:0,heading:0,yaw:0};gait=createGait(player,()=>({height:0,surface:'dust'}));time=0;
 for(let i=0;i<135;i++)step();render();
}
function step(){movePlayer(player,controls[mode],1/60,false,{collides:()=>false});time+=1/60;updateGait(gait,{player,dt:1/60,grounded:true});avatar.update(player,{time,gait:gaitView(gait),mobility:{}},0,1/60);}
function render(){
 renderer.setScissorTest(true);const result=[];
 for(let i=0;i<8;i++){
  const angle=i*Math.PI/4;camera.position.set(player.x+Math.sin(angle)*3.5,1.07,player.z-Math.cos(angle)*3.5);camera.lookAt(player.x,.94,player.z);
  const x=i%4*400,y=i<4?450:0;renderer.setViewport(x,y,400,450);renderer.setScissor(x,y,400,450);renderer.render(scene,camera);
  result.push({angle,camera:camera.position.toArray(),calls:renderer.info.render.calls});
 }
 renderer.setScissorTest(false);return result;
}
window.c2Preview={reset,assetReady:avatar.assetReady,assetStatus:()=>avatar.root.userData.characterAsset,assetBounds(){avatar.root.updateMatrixWorld(true);return avatar.root.children.filter(o=>o.name.startsWith('c2-authored-')).map(o=>{o.computeBoundingBox();return {name:o.name,min:o.boundingBox.min.toArray(),max:o.boundingBox.max.toArray()};});},advance(frames=1,draw=true){for(let i=0;i<frames;i++)step();if(draw)render();return avatar.poseSnapshot();},render,snapshot:()=>avatar.poseSnapshot()};
reset();
avatar.assetReady.then(()=>render());
const selector=document.querySelector('#motion');
if(selector){
 let playing=false,last=0,carry=0;
 selector.addEventListener('change',()=>reset(selector.value));
 document.querySelector('#play').addEventListener('click',e=>{playing=!playing;e.target.textContent=playing?'暂停动作':'播放动作';last=0;});
 document.querySelector('#step').addEventListener('click',()=>window.c2Preview.advance(6));
 function animate(now){
  if(playing){carry+=last?Math.min((now-last)/1000,.1):0;let changed=false;while(carry>=1/60){step();carry-=1/60;changed=true;}if(changed)render();}
  last=now;requestAnimationFrame(animate);
 }
 requestAnimationFrame(animate);
}
