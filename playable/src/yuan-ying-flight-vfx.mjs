import * as THREE from 'three';

// Thin wrist/sole trails from docs/art/flight-r2/flight-reference.png.
// One point batch + one ribbon batch; no lights, texture uploads or allocations
// in the animation loop. They are energy, never a solid foot platform.
export function createYuanYingFlightVfx(){
  const root=new THREE.Group();root.name='yuan-ying-innate-flight';root.visible=false;
  const origins=[new THREE.Vector3(-.42,.85,-.05),new THREE.Vector3(.42,.85,-.05),new THREE.Vector3(-.1,.08,0),new THREE.Vector3(.1,.08,0)];
  const uniforms={clock:{value:0},speed:{value:0},first:{value:0},origins:{value:origins}};
  const geometry=new THREE.BufferGeometry(),count=64,positions=new Float32Array(count*3),seeds=new Float32Array(count*3);
  for(let i=0;i<count;i++){seeds[i*3]=(i*.61803398875)%1;seeds[i*3+1]=(i*.38196601125)%1;seeds[i*3+2]=i%4;}
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('seed',new THREE.BufferAttribute(seeds,3));
  const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`attribute vec3 seed;uniform float clock,speed,first;uniform vec3 origins[4];varying float fade,gold;
      void main(){float age=fract(seed.x+clock*(.38+seed.y*.2));int emitter=int(seed.z);vec3 p=origins[emitter];
      float phase=seed.y*6.283+age*5.;float radius=.01+age*.10;
      p+=vec3(cos(phase)*radius,-age*(.45+speed*.25),sin(phase)*radius+age*speed*1.8);
      fade=sin(age*3.14159)*(.16+.20*seed.y)*(first>.5?(emitter>1?0.:.12):1.);gold=step(.94,seed.y);
      vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((gold>.5?1.8:2.5)*90./max(1.,-mv.z),1.,7.);}`,
    fragmentShader:`varying float fade,gold;void main(){float r=length(gl_PointCoord-.5)*2.;float a=pow(max(0.,1.-r),2.)*fade;gl_FragColor=vec4(mix(vec3(.34,.87,.88),vec3(1.,.72,.29),gold),a);}`});
  const points=new THREE.Points(geometry,material);points.frustumCulled=false;root.add(points);
  const ribbonGeometry=new THREE.BufferGeometry(),ribbonCount=4,segments=16,verts=new Float32Array(ribbonCount*(segments+1)*2*3),coords=new Float32Array(ribbonCount*(segments+1)*2*3),indices=[];
  for(let r=0;r<ribbonCount;r++)for(let s=0;s<=segments;s++)for(let side=0;side<2;side++){const i=(r*(segments+1)+s)*2+side;coords.set([s/segments,side*2-1,r],i*3);if(s<segments&&side===0)indices.push(i,i+2,i+1,i+1,i+2,i+3);}
  ribbonGeometry.setAttribute('position',new THREE.BufferAttribute(verts,3));ribbonGeometry.setAttribute('ribbon',new THREE.BufferAttribute(coords,3));ribbonGeometry.setIndex(indices);
  const ribbonMaterial=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    vertexShader:`attribute vec3 ribbon;uniform float clock,speed,first;uniform vec3 origins[4];varying float fade;
      void main(){float t=ribbon.x;int emitter=int(mod(ribbon.z,4.));float phase=clock*1.7+ribbon.z*1.13+t*7.;
      vec3 p=origins[emitter]+vec3(cos(phase)*(.015+t*.085),-t*(.35+speed*.2),sin(phase)*(.015+t*.085)+t*speed*2.4);
      p.x+=ribbon.y*.005*sin(t*3.14159);fade=sin(t*3.14159)*.15*(first>.5?(emitter>1?0.:.12):1.);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`varying float fade;void main(){gl_FragColor=vec4(.36,.89,.87,fade);}`});
  const ribbons=new THREE.Mesh(ribbonGeometry,ribbonMaterial);ribbons.frustumCulled=false;root.add(ribbons);
  const tmp=new THREE.Vector3();
  return {root,update(flight,time,avatar,firstPerson=false){root.visible=!!flight?.active;if(!root.visible)return;
    root.position.copy(avatar.position);root.quaternion.copy(avatar.quaternion);uniforms.clock.value=time;uniforms.speed.value=Math.min(1,Math.max(0,(flight.speed||0))/420);uniforms.first.value=firstPerson?1:0;
    avatar.updateMatrixWorld(true);
    for(const [i,name] of [[0,'wristL'],[1,'wristR'],[2,'ankleL'],[3,'ankleR']]){const bone=avatar.getObjectByName('c2-native-'+name);if(bone){bone.localToWorld(tmp.set(0,i<2?-.09:-.06,0));avatar.worldToLocal(tmp);origins[i].copy(tmp);}}
  },snapshot(){return {active:root.visible,points:count,ribbonTriangles:ribbonCount*segments*2,drawCalls:2};},dispose(){geometry.dispose();material.dispose();ribbonGeometry.dispose();ribbonMaterial.dispose();}};
}
