import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ASCENSION_RULES} from './planet-gameplay/ascension-rules.mjs';
const entries=[
 {realm:4,id:'qi-boost',name:'元婴 · 御气流',description:'青色丝带沿自身灵息螺旋展开。加速时形成更紧的气流，松键回到常规悬停。',combat:'R：气刃，32 米射程。首次开放自身御空与空中作战。'},
 {realm:5,id:'aerial-crescent',name:'化神 · 月牙气刃',description:'月牙形刃面与错位碎片表现凝聚灵力。化神强调快速连续飞行；残影是速度表现，此境界尚不能真正瞬移。',combat:'R：残影刃，38 米射程。强化气刃，保留可躲避前摇。'},
 {realm:6,id:'blink-aperture',name:'炼虚 · 碎晶虚孔',description:'三层碎晶绕空洞交错。首次将连续飞行与真正的空间虚步分开，起点和落点出现短暂晶门。',combat:'R：裂斩，42 米射程、局部 2.3 米影响；短 / 长虚步冷却 8 / 20 秒。'},
 {realm:7,id:'domain-gate',name:'合道 · 符文界环',description:'青铜符文环将碎裂空间约束为稳定通道。雕刻分段、内侧刻槽和悬浮节点共同表现更精确的空间控制。',combat:'R：裂斩；短 / 长虚步冷却 7 / 18 秒。界门扩展为 30 / 180 米。'},
 {realm:8,id:'void-fracture',name:'星劫 · 破虚裂隙',description:'不规则裂口与尖锐晶棱打破圆环秩序。蓄力后释放局部破虚，裂面向瞄准方向张开。',combat:'R：破虚，50 米射程、局部 6 米影响、1.8 秒前摇；虚步冷却 6 / 16 秒。'},
 {realm:9,id:'dao-gate',name:'道源 · 残月界门',description:'雕纹残月环、多层轨道与断裂晶翼组成终阶界门。金色刻纹强调秩序，冷色裂面保留空间不稳定感。',combat:'R：大破虚，60 米射程、局部 9 米影响、2.2 秒前摇；虚步冷却 5 / 14 秒。'},
];
const el=id=>document.getElementById(id),viewer=el('viewer'),scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(42,1,.01,200);camera.position.set(4,2.5,6);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;viewer.prepend(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.5;controls.maxDistance=30;
scene.add(new THREE.HemisphereLight(0xd8f6ff,0x554357,2));const key=new THREE.DirectionalLight(0xffe4bd,3);key.position.set(3,5,4);scene.add(key);const rim=new THREE.DirectionalLight(0x68e6ff,3);rim.position.set(-4,2,-2);scene.add(rim);
const loader=new GLTFLoader(),cache=new Map();let current=null,revision=0,selected=4;
for(const item of entries){const r=ASCENSION_RULES[item.realm],button=document.createElement('button');button.textContent=item.name;button.type='button';button.dataset.realm=item.realm;button.onclick=()=>select(item);el('cards').append(button);const row=document.createElement('tr');for(const text of [item.name.split(' · ')[0],`${r.cruise} / ${r.boost}`,r.short?`${r.short} / ${r.long}`:'未解锁',item.combat]){const td=document.createElement('td');td.textContent=text;row.append(td);}el('rules').append(row);}
async function select(item){const request=++revision;selected=item.realm;const r=ASCENSION_RULES[item.realm];for(const b of el('cards').children)b.setAttribute('aria-pressed',String(Number(b.dataset.realm)===item.realm));el('rank').textContent=`R${item.realm} / 真实游戏资产`;el('name').textContent=item.name;el('description').textContent=item.description;el('combat').textContent=item.combat;el('speed').textContent=`${r.cruise} / ${r.boost}`;el('blink').textContent=r.short?`${r.short} / ${r.long}`:'未解锁';el('try').href=`./star-abyss.html?testLab=1&realm=${item.realm}`;for(const ext of ['glb','blend'])el(ext).href=`./assets/ascension-r8/${item.id}.${ext}`;el('status').textContent='正在载入真实 GLB…';if(current){scene.remove(current);current=null;}
 try{let object=cache.get(item.id);if(!object){object=(await loader.loadAsync(`./assets/ascension-r8/${item.id}.glb`)).scene;cache.set(item.id,object);}if(request!==revision)return;current=object;scene.add(object);const box=new THREE.Box3().setFromObject(object),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),radius=Math.max(size.x,size.y,size.z);controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(.65,.3,1).multiplyScalar(radius*1.8));camera.near=Math.max(.01,radius/100);camera.updateProjectionMatrix();controls.update();el('status').textContent='已载入 · 拖拽旋转 / 滚轮缩放';}catch(error){el('status').textContent='模型载入失败：'+error.message;}
}
new ResizeObserver(()=>{renderer.setSize(viewer.clientWidth,viewer.clientHeight);camera.aspect=viewer.clientWidth/viewer.clientHeight;camera.updateProjectionMatrix();}).observe(viewer);
renderer.setAnimationLoop(()=>{if(document.hidden)return;controls.update();renderer.render(scene,camera);});
window.__ASCENSION_GALLERY__={snapshot:()=>({realm:selected,loaded:!!current,meshes:current?Array.from(function*(){const a=[];current.traverse(o=>{if(o.isMesh)a.push(o.name);});yield* a;}()):[],status:el('status').textContent})};
void select(entries[0]);
