import * as THREE from 'three';
import { CAMP_STEP } from '../../assets/camp-v2/actors/camp-step.mjs';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
/** Build local skeletal motion on the delivered mesh, never rotate the whole statue for idle. */
export function createNPCRig(gltf,{height=1.78}={}){
 const template=gltf?.scene;if(!template?.isObject3D)throw Error('NPC缺少GLB场景');template.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(template),size=bounds.getSize(new THREE.Vector3());if(!Number.isFinite(size.y)||size.y<=0)throw Error('NPC模型包围盒无效');
 const root=new THREE.Group(),model=new THREE.Group();root.add(model);const scale=height/size.y,center=bounds.getCenter(new THREE.Vector3());
 const transform=new THREE.Matrix4().makeScale(scale,scale,scale).multiply(new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z));
 const jointDefs=[['pelvis',-1,0,height*.50,0],['chest',0,0,height*.72,0],['neck',1,0,height*.86,0],['head',2,0,height*.92,0],['arm-left',1,-height*.20,height*.73,0],['arm-right',1,height*.20,height*.73,0],['thigh-left',0,-height*.085,height*.50,0],['knee-left',6,-height*.085,height*.27,0],['ankle-left',7,-height*.085,height*.06,0],['thigh-right',0,height*.085,height*.50,0],['knee-right',9,height*.085,height*.27,0],['ankle-right',10,height*.085,height*.06,0]];
 const bones=jointDefs.map(([name,,x,y,z])=>{const b=new THREE.Bone();b.name='quest-'+name;b.position.set(x,y,z);return b;});
 for(let i=0;i<bones.length;i++){const parent=jointDefs[i][1];if(parent<0)model.add(bones[i]);else {bones[i].position.sub(new THREE.Vector3(...jointDefs[parent].slice(2)));bones[parent].add(bones[i]);}}
 const meshes=[],materials=new Set(),textures=new Set();let vertices=0;
 template.traverse(o=>{if(!o.isMesh||!o.geometry?.attributes.position)return;const geometry=o.geometry.clone().applyMatrix4(transform.clone().multiply(o.matrixWorld));const pos=geometry.attributes.position,indices=[],weights=[];
   for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),h=y/height;let joint=0,blend=0;
     if(h>.84){joint=3;blend=clamp((h-.84)/.05,0,1);}else if(Math.abs(x)>height*.19&&h>.40&&h<.82){joint=x<0?4:5;blend=clamp((Math.abs(x)/height-.16)/.08,0,1);}else if(h>.55){joint=1;blend=clamp((h-.55)/.13,0,1);}
     if(h<.51){
       // A continuous centre seam lets aprons/coats follow both legs without splitting.
       const right=clamp((x/height+.055)/.11,0,1),leg=clamp((.51-h)/.12,0,1);
       let upper=6,lower=7,t=clamp((.32-h)/.10,0,1);
       if(h<.15){upper=7;lower=8;t=clamp((.15-h)/.07,0,1);}
       const entries=[[0,1-leg],[upper,leg*(1-right)*(1-t)],[lower,leg*(1-right)*t],[upper+3,leg*right*(1-t)],[lower+3,leg*right*t]].filter(e=>e[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,4);
       const sum=entries.reduce((n,e)=>n+e[1],0);while(entries.length<4)entries.push([0,0]);
       indices.push(...entries.map(e=>e[0]));weights.push(...entries.map(e=>e[1]/sum));
     }else{indices.push(0,joint,0,0);weights.push(1-blend,blend,0,0);}
   }
   geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
   const mats=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const c=m.clone();materials.add(c);for(const value of Object.values(c))if(value?.isTexture)textures.add(value);return c;});
   const mesh=new THREE.SkinnedMesh(geometry,Array.isArray(o.material)?mats:mats[0]);mesh.name=o.name;mesh.castShadow=true;mesh.receiveShadow=true;model.add(mesh);meshes.push(mesh);vertices+=pos.count;
 });
 if(!meshes.length)throw Error('NPC没有可渲染网格');model.updateMatrixWorld(true);const skeleton=new THREE.Skeleton(bones);skeleton.calculateInverses();for(const mesh of meshes)mesh.bind(skeleton,new THREE.Matrix4());
  skeleton.update();let clock=0,phase=0,move=0,work=0,lastSpeed=0;
 function update({dt=0,time=clock,lookYaw=0,talking=false,speed=0,stride=CAMP_STEP.stride,turn=0,working=false}={}){clock=time;
   const stepDt=clamp(dt,0,.1),walkSpeed=clamp(Number.isFinite(speed)?Math.abs(speed):0,0,.65);
   move+=(clamp(walkSpeed/.12,0,1)-move)*(1-Math.exp(-stepDt*12));
   work+=((working&&!walkSpeed?1:0)-work)*(1-Math.exp(-stepDt*6));
   phase=(phase+stepDt*walkSpeed/Math.max(.18,stride))%1;lastSpeed=walkSpeed;
   const index=phase*CAMP_STEP.frames.length,lo=Math.floor(index)%CAMP_STEP.frames.length,hi=(lo+1)%CAMP_STEP.frames.length,alpha=index-lo;
   for(let side=0;side<2;side++)for(let joint=0;joint<3;joint++){
     const k=side*3+joint,a=CAMP_STEP.frames[lo][k],b=CAMP_STEP.frames[hi][k];
     bones[6+k].rotation.x=(a+(b-a)*alpha)*move;
   }
   bones[0].position.y=height*.50-CAMP_STEP.pelvisDrop*(height/1.78)*move;
   bones[0].rotation.y=clamp(turn,-1,1)*.025*move;
   bones[1].rotation.x=Math.sin(time*1.65)*.012;
   bones[1].rotation.x+=work*.07;
   bones[2].rotation.y=clamp(lookYaw,-.65,.65)*.25;bones[3].rotation.y=clamp(lookYaw,-.65,.65)*.75;
   bones[3].rotation.x=Math.sin(time*(talking?3.2:1.1))*(talking?.035:.009);
   bones[4].rotation.z=Math.sin(time*1.4)*.014;bones[5].rotation.z=-Math.sin(time*1.4)*.014;
   bones[4].rotation.x=-bones[6].rotation.x*.42-work*(.16+Math.sin(time*1.7)*.04);
   bones[5].rotation.x=-bones[9].rotation.x*.42-work*(.12-Math.sin(time*1.7)*.03);
   model.updateMatrixWorld(true);skeleton.update();
 }
 return {root,bones,skeleton,vertices,update,dispose(){root.removeFromParent();meshes.forEach(m=>m.geometry.dispose());materials.forEach(m=>m.dispose());skeleton.dispose();},snapshot:()=>({mode:'delivered-mesh-local-skin',clip:CAMP_STEP.name,speed:lastSpeed,phase,move,work,vertices,bones:bones.map(b=>({name:b.name,rotation:b.rotation.toArray().slice(0,3)})),rootRotation:root.rotation.toArray().slice(0,3)})};
}
