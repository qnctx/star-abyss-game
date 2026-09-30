import * as THREE from 'three';
import {createAvatar} from '../src/avatar.mjs';
import {createGait,updateGait,gaitView} from '../src/gait.mjs';
import {movePlayer} from '../src/movement.mjs';

const stage=document.getElementById('stage'),labels=document.getElementById('labels');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(1.5,devicePixelRatio||1));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.setScissorTest(true);stage.prepend(renderer.domElement);
const sample=()=>({height:0,surface:'dust'}),directions=[['forward','W 前进',[0,-1]],['backward','S 后退',[0,1]],['left','A 左移',[-1,0]],['right','D 右移',[1,0]]];
let playing=!window.__GAIT_PREVIEW_TEST__,runSpeed=8.6,stress=false,cameraAngle='rear',timeScale=1,clock=0,last=performance.now();
const panels=[];
for(let row=0;row<2;row++)for(const[id,title,direction]of directions){
  const scene=new THREE.Scene();scene.background=new THREE.Color(row?'#303a32':'#394037');
  scene.add(new THREE.HemisphereLight('#efe8cf','#77715c',2.3));
  const key=new THREE.DirectionalLight('#fff1d1',2.8);key.position.set(-3,5,2);scene.add(key);
  const fill=new THREE.DirectionalLight('#c4cfdf',1.5);fill.position.set(2,3,-4);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#535b4b',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.002;scene.add(floor);
  const grid=new THREE.GridHelper(1000,1000,'#59684e','#55614b');grid.position.y=.001;scene.add(grid);
  const avatar=createAvatar([]);scene.add(avatar.root);
  const player={x:0,y:0,z:0,heading:0,yaw:0,pitch:0,vx:0,vz:0};
  const label=document.createElement('div');label.className='pane-label';label.innerHTML='<span></span><small></small>';labels.appendChild(label);
  panels.push({id:(row?'run-':'walk-')+id,title,row,direction,scene,floor,grid,avatar,player,gait:createGait(player,sample),speed:0,camera:new THREE.PerspectiveCamera(32,1,.05,300),label});
}
function resize(){renderer.setSize(stage.clientWidth,stage.clientHeight,false);}
window.addEventListener('resize',resize);resize();
function step(dt){
  clock+=dt;
  for(const panel of panels){
    const {player,direction}=panel;
    const input={forward:direction[1]<0,backward:direction[1]>0,left:direction[0]<0,right:direction[0]>0,walk:!panel.row,sprint:!!panel.row&&runSpeed>5};
    // Same heading, directional limits and acceleration as the real controller.
    // The flat inspection stage intentionally has no gameplay obstacle geometry.
    const options={collides:()=>false};
    if(stress&&panel.row&&panel.id!=='run-forward')options.speed=runSpeed;
    movePlayer(player,input,dt,true,options);
    panel.speed=Math.hypot(player.vx,player.vz);
    updateGait(panel.gait,{player,dt,grounded:true,mounted:false,sampleGround:sample});
    panel.avatar.update(player,{gait:gaitView(panel.gait),time:clock,mobility:{}},0,dt);
    // This inspection uses a flat physical fixture, not the game's procedural
    // terrain. Project the existing contact shadow onto that same fixture.
    const contact=panel.avatar.root.getObjectByName('explorer-contact-shadow');
    contact.visible=true;const vertices=contact.geometry.getAttribute('position');
    for(let i=0;i<vertices.count;i++)vertices.setY(i,.006);vertices.needsUpdate=true;
    panel.grid.position.x=Math.floor(player.x/100)*100;panel.grid.position.z=Math.floor(player.z/100)*100;
    panel.floor.position.x=Math.round(player.x/50)*50;panel.floor.position.z=Math.round(player.z/50)*50;
  }
}
function render(){
  const width=stage.clientWidth,height=stage.clientHeight,columns=width<760?2:4,rows=8/columns;
  for(let i=0;i<panels.length;i++){
    const panel=panels[i],{player,camera}=panel;
    const x=i%columns*width/columns,y=height-(Math.floor(i/columns)+1)*height/rows,w=width/columns,h=height/rows;
    const offset={rear:[2.65,1.75,3.60],back:[0,1.55,4.40],side:[4.35,1.55,.35],front:[-.20,1.55,-4.40]}[cameraAngle];
    camera.position.set(player.x+offset[0],offset[1],player.z+offset[2]);camera.lookAt(player.x,.94,player.z);camera.aspect=w/h;camera.updateProjectionMatrix();
    renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);renderer.render(panel.scene,camera);
    const view=gaitView(panel.gait),label=stress&&panel.row&&panel.id!=='run-forward'?'超速压力测试':panel.row?(panel.id==='run-forward'?(runSpeed>5?'冲刺':'常速跑'):'侧／后步'):'谨慎慢走';
    panel.label.querySelector('span').textContent=panel.title+' · '+label+' '+panel.speed.toFixed(2)+' m/s';
    panel.label.querySelector('small').textContent='相位 '+view.phase.toFixed(2)+' · '+view.feet.filter(f=>f.stance).length+' 足支撑';
  }
  document.getElementById('preview-status').textContent=playing?'连续播放中':'已暂停，可逐帧检查';
}
function advance(seconds,{capture=false}={}){
  const frames=[],count=Math.max(1,Math.ceil(seconds*120)),dt=seconds/count;
  for(let i=0;i<count;i++){
    step(dt);
    if(capture)frames.push(panels.map(panel=>({id:panel.id,speed:panel.speed,...panel.avatar.poseSnapshot()})));
  }
  render();return frames;
}
function reset(){
  clock=0;for(const panel of panels){Object.assign(panel.player,{x:0,y:0,z:0,heading:0,yaw:0,pitch:0,vx:0,vz:0});panel.speed=0;panel.gait=createGait(panel.player,sample);panel.avatar.update(panel.player,{gait:gaitView(panel.gait),mobility:{}},0,0);}
  render();
}
document.getElementById('pause-preview').addEventListener('click',()=>{playing=!playing;document.getElementById('pause-preview').textContent=playing?'暂停':'继续';render();});
document.getElementById('run-speed').addEventListener('change',event=>{runSpeed=Number(event.target.value);render();});
document.getElementById('lateral-mode').addEventListener('change',event=>{stress=event.target.value==='stress';render();});
document.getElementById('camera-angle').addEventListener('change',event=>{cameraAngle=event.target.value;render();});
document.getElementById('time-scale').addEventListener('change',event=>{timeScale=Number(event.target.value);});
document.getElementById('restart-preview').addEventListener('click',reset);
function animate(now){
  const dt=Math.min(.05,(now-last)/1000)*timeScale;last=now;
  if(playing&&dt>0){const count=Math.ceil(dt*120);for(let i=0;i<count;i++)step(dt/count);render();}
  requestAnimationFrame(animate);
}
window.gaitPreview={advance,reset,snapshot:()=>panels.map(panel=>({id:panel.id,speed:panel.speed,...panel.avatar.poseSnapshot()})),setSpeed(value){runSpeed=value;document.getElementById('run-speed').value=String(value);},setStress(value){stress=!!value;document.getElementById('lateral-mode').value=stress?'stress':'gameplay';},setCamera(value){cameraAngle=value;document.getElementById('camera-angle').value=value;render();},render};
reset();requestAnimationFrame(animate);
