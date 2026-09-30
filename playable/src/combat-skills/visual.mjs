import * as THREE from 'three';
import {SKILLS} from './definitions.mjs';
import {createSkillWeapon} from './weapons.mjs';
import {forward,along} from './geometry.mjs';
export function createSkillVisual({scene,avatar,ground}){
 const root=new THREE.Group();root.name='combat-skills-v001';scene.add(root);const nodes=new Map();let weapon=null,kind=null;
 const mat=(color,opacity=.8)=>new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false});
 const line=(points,color)=>new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),mat(color));
 const arc=(radius,start,end,y=0)=>Array.from({length:33},(_,i)=>{const a=start+(end-start)*i/32;return [Math.sin(a)*radius,y,-Math.cos(a)*radius];});
 function effect(c){const group=new THREE.Group(),d=SKILLS[c.skillId],k=c.mastery;group.name=`${c.skillId}:${c.id}`;
  if(c.skillId==='WS01'){for(let n=0;n<k;n++)group.add(line(arc(2.85+n*.02,-Math.PI/3.6,Math.PI/3.6),0x7bdfff));}
  if(c.skillId==='WS03'){group.add(line([[0,0,0],[0,0,-3]],0xffe7a8));group.add(line([[-.09,0,-2.92],[0,0,-3.05],[.09,0,-2.92]],0xffe7a8));}
  if(c.skillId==='ES05'){for(let n=0;n<4;n++){const a=n*Math.PI/2;group.add(line([[0,0,-.65],[Math.cos(a)*.12,Math.sin(a)*.12,0],[0,0,.38],[0,0,-.65]],0x66dfff));}group.add(line([[0,0,.3],[0,0,1.2]],0x4d9ebd));}
  if(c.skillId==='ES13'){group.add(line(arc(1,0,Math.PI*2,.03),0xd7afff));for(let n=0;n<12;n++){const a=n*Math.PI/6;group.add(line([[Math.sin(a)*.85,.03,-Math.cos(a)*.85],[Math.sin(a),.03,-Math.cos(a)]],0xe4cbff));}group.add(line([[0,0,0],[.08,2,0],[-.07,3.5,0],[0,6,0]],0xf0dfff));}
  if(c.skillId==='HS04'){for(let row=0;row<5;row++)for(let col=0;col<9;col++){const a=-Math.PI/3+(col+.5*(row%2))*Math.PI/13,y=-.8+row*.36;const pts=Array.from({length:7},(_,n)=>{const theta=n*Math.PI/3;const angle=a+Math.cos(theta)*.1;return [Math.sin(angle)*1.25,y+Math.sin(theta)*.2,-Math.cos(angle)*1.25];});group.add(line(pts,0x8bc8ef));}}
  if(c.skillId==='HS06'){for(let n=0;n<12;n++){const a=n*Math.PI/6;group.add(line([[Math.sin(a)*.4,-.75,-Math.cos(a)*.4],[Math.sin(a+.2)*.6,0,-Math.cos(a+.2)*.6],[Math.sin(a)*.35,.8,-Math.cos(a)*.35]],0xf9d17b));}}
  root.add(group);return group;
 }
 function update(combat){const s=combat?.skills,now=s?.time||0,active=new Set();
  const requested=SKILLS[s?.phase?.skillId]?.weapon||s?.weapon||null;if(requested!==kind){weapon?.removeFromParent();weapon?.traverse(o=>{o.geometry?.dispose();});weapon=requested?createSkillWeapon(requested):null;kind=requested;}
  if(weapon){const hand=avatar.root.getObjectByName('c2-native-wristR');if(hand&&weapon.parent!==hand)hand.add(weapon);weapon.visible=!s?.phase||SKILLS[s.phase.skillId]?.slot==='weapon';}
  for(const c of s?.casts||[]){if(c.interrupted)continue;const d=SKILLS[c.skillId],barrier=s.barriers[s.actorId];const until=d.id==='HS04'&&barrier?.castId===c.id?barrier.until:c.end;
   if(now>until&&!(d.hit==='H2'&&!c.projectileDone))continue;
   const node=nodes.get(c.id)||effect(c);nodes.set(c.id,node);active.add(c.id);node.rotation.y=c.yaw;node.position.set(c.origin.x,c.origin.y,c.origin.z);
   if(d.hit==='H3'){const base=ground(c.target.x,c.target.z);node.position.set(c.target.x,base+.08,c.target.z);node.children.at(-1).visible=now>=c.release;
    if(!node.userData.projected){const cos=Math.cos(c.yaw),sin=Math.sin(c.yaw);for(const child of node.children.slice(0,-1)){const p=child.geometry.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,ground(c.target.x+x*cos+z*sin,c.target.z-x*sin+z*cos)-base);}p.needsUpdate=true;}node.userData.projected=true;}
   }
   else if(d.hit==='H2'){const p=along(c.origin,forward(c.yaw),Math.max(0,Math.min(d.range,(now-c.release)*24)));node.position.set(p.x,p.y,p.z);node.visible=now>=c.release&&!c.projectileDone;}
   else node.visible=now>=c.release;
   const alpha=d.hit==='H6'?.7:now<c.release?.5:Math.max(.1,1-(now-c.activeEnd)/d.recovery);node.traverse(o=>{if(o.material)o.material.opacity=alpha;});
  }
  for(const [id,node]of nodes)if(!active.has(id)){node.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});node.removeFromParent();nodes.delete(id);}
 }
 return {update,dispose(){update(null);weapon?.removeFromParent();root.removeFromParent();}};
}
