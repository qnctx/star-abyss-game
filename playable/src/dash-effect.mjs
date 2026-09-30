import * as THREE from 'three';
import { terrainHeight, surfaceAt } from './layout.mjs';

const TRAIL_COUNT=16, PARTICLE_COUNT=24, FADE_TIME=.28, MAX_GAP=3;

// A presentation-only pool. All locations are simulation world positions, never camera offsets.
export function createDashEffect() {
  const root=new THREE.Group();root.name='world-vector-dash';root.visible=false;
  const trailPosition=new Float32Array(TRAIL_COUNT*12),trailFade=new Float32Array(TRAIL_COUNT*4);
  const trailGeometry=new THREE.BufferGeometry();
  trailGeometry.setAttribute('position',new THREE.BufferAttribute(trailPosition,3).setUsage(THREE.DynamicDrawUsage));
  trailGeometry.setAttribute('fade',new THREE.BufferAttribute(trailFade,1).setUsage(THREE.DynamicDrawUsage));
  const trailMaterial=new THREE.ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,
    vertexShader:'attribute float fade; varying float a; void main(){a=fade;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying float a; void main(){gl_FragColor=vec4(.36,.77,.82,a*.34);}'});
  const trails=new THREE.LineSegments(trailGeometry,trailMaterial);trails.frustumCulled=false;root.add(trails);
  const jetGeometry=new THREE.ConeGeometry(.035,.24,7);
  jetGeometry.translate(0,-.12,0);
  const jetMaterial=new THREE.MeshBasicMaterial({color:0x81cfdb,transparent:true,opacity:.32,depthTest:true,depthWrite:false});
  const jets=[new THREE.Mesh(jetGeometry,jetMaterial),new THREE.Mesh(jetGeometry,jetMaterial)];
  for(const jet of jets)root.add(jet);
  const particlePosition=new Float32Array(PARTICLE_COUNT*3),particleFade=new Float32Array(PARTICLE_COUNT),particleColor=new Float32Array(PARTICLE_COUNT*3);
  const particleGeometry=new THREE.BufferGeometry();
  particleGeometry.setAttribute('position',new THREE.BufferAttribute(particlePosition,3).setUsage(THREE.DynamicDrawUsage));
  particleGeometry.setAttribute('fade',new THREE.BufferAttribute(particleFade,1).setUsage(THREE.DynamicDrawUsage));
  particleGeometry.setAttribute('tint',new THREE.BufferAttribute(particleColor,3).setUsage(THREE.DynamicDrawUsage));
  const particleMaterial=new THREE.ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,
    vertexShader:'attribute float fade; attribute vec3 tint; varying float a; varying vec3 c; void main(){a=fade;c=tint;vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=clamp(28.0/max(1.0,-p.z),1.0,5.0);}',
    fragmentShader:'varying float a; varying vec3 c; void main(){float r=length(gl_PointCoord-vec2(.5));if(r>.5)discard;gl_FragColor=vec4(c,a*(1.0-r*2.0)*.48);}'});
  const points=new THREE.Points(particleGeometry,particleMaterial);points.frustumCulled=false;root.add(points);
  const segments=Array.from({length:TRAIL_COUNT},()=>({age:FADE_TIME,x:0,y:0,z:0,px:0,py:0,pz:0,sx:0,sz:0}));
  const particles=Array.from({length:PARTICLE_COUNT},()=>({age:FADE_TIME,x:0,y:0,z:0,vx:0,vy:0,vz:0}));
  const axis=new THREE.Vector3(0,1,0),direction=new THREE.Vector3();
  let serial=null,lastX=0,lastY=0,lastZ=0,hasLast=false,segmentCursor=0,particleCursor=0,emissionDistance=0,jetLife=0,disposed=false;
  let activeTrails=0,activeParticles=0,lastSurface=null,maxSegmentLength=0;
  function reset(){for(const s of segments)s.age=FADE_TIME;for(const p of particles)p.age=FADE_TIME;hasLast=false;emissionDistance=0;jetLife=0;}
  return {root,update(state,player,delta){
    if(disposed || !Number.isFinite(delta) || delta<=0)return;
    const dt=Math.min(delta,.05);
    const valid=player && Number.isFinite(player.x) && Number.isFinite(player.y) && Number.isFinite(player.z);
    const active=!!state?.active && valid;
    if(state?.serial!==serial){reset();serial=state?.serial;}
    for(const s of segments)s.age+=dt;
    for(const p of particles){if(p.age<FADE_TIME){p.age+=dt;p.vy-=3.2*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;}}
    jetLife=Math.max(0,jetLife-dt);
    if(active){
      if(!hasLast){const o=state.origin;const usable=o && [o.x,o.y,o.z].every(Number.isFinite) && Math.hypot(player.x-o.x,player.y-o.y,player.z-o.z)<=MAX_GAP;
        lastX=usable?o.x:player.x;lastY=usable?o.y:player.y;lastZ=usable?o.z:player.z;hasLast=true;}
      const distance=Math.hypot(player.x-lastX,player.y-lastY,player.z-lastZ);
      if(distance>MAX_GAP){reset();hasLast=true;}
      const magnitude=Math.hypot(state.dirX,state.dirZ);
      const dx=Number.isFinite(magnitude)&&magnitude>.001?state.dirX/magnitude:0;
      const dz=Number.isFinite(magnitude)&&magnitude>.001?state.dirZ/magnitude:-1;
      const sx=-dz*.14,sz=dx*.14;
      if(distance>.005 && distance<=MAX_GAP){
        const s=segments[segmentCursor++%TRAIL_COUNT];Object.assign(s,{age:0,x:player.x,y:player.y+.22,z:player.z,px:lastX,py:lastY+.22,pz:lastZ,sx,sz});
        emissionDistance+=distance;
        lastSurface=surfaceAt(player.x,player.z);
        const ground=terrainHeight(player.x,player.z);
        if(emissionDistance>=.28 && Math.abs(player.y-ground)<.12 && lastSurface!=='metal'){
          emissionDistance=0;
          for(let side=-1;side<=1;side+=2){
            const index=particleCursor++%PARTICLE_COUNT,p=particles[index];
            Object.assign(p,{age:0,x:player.x+sx*side,y:ground+.035,z:player.z+sz*side,vx:-dx*.35+sx*side*2,vy:.25+(index%4)*.09,vz:-dz*.35+sz*side*2});
            const tint=lastSurface==='dust'?[.48,.42,.39]:[.35,.34,.38];particleColor.set(tint,index*3);
          }
        }
      }
      direction.set(dx,0,dz);jetLife=.1;
      for(let i=0;i<2;i++){jets[i].position.set(player.x+sx*(i?1:-1),player.y+.24,player.z+sz*(i?1:-1));jets[i].quaternion.setFromUnitVectors(axis,direction);}
      lastX=player.x;lastY=player.y;lastZ=player.z;
    }else hasLast=false;
    activeTrails=0;activeParticles=0;maxSegmentLength=0;
    for(let i=0;i<TRAIL_COUNT;i++){
      const s=segments[i],fade=Math.max(0,1-s.age/FADE_TIME);if(fade>0){activeTrails++;maxSegmentLength=Math.max(maxSegmentLength,Math.hypot(s.x-s.px,s.y-s.py,s.z-s.pz));}
      for(let side=0;side<2;side++){const sign=side?1:-1,j=i*12+side*6;trailPosition[j]=s.px+s.sx*sign;trailPosition[j+1]=s.py;trailPosition[j+2]=s.pz+s.sz*sign;trailPosition[j+3]=s.x+s.sx*sign;trailPosition[j+4]=s.y;trailPosition[j+5]=s.z+s.sz*sign;trailFade[i*4+side*2]=fade*.7;trailFade[i*4+side*2+1]=fade;}
    }
    for(let i=0;i<PARTICLE_COUNT;i++){const p=particles[i],fade=Math.max(0,1-p.age/FADE_TIME);if(fade>0)activeParticles++;particlePosition[i*3]=p.x;particlePosition[i*3+1]=p.y;particlePosition[i*3+2]=p.z;particleFade[i]=fade;}
    trailGeometry.attributes.position.needsUpdate=true;trailGeometry.attributes.fade.needsUpdate=true;
    for(const a of Object.values(particleGeometry.attributes))a.needsUpdate=true;
    jetMaterial.opacity=.32*Math.min(1,jetLife/.1);for(const jet of jets)jet.visible=jetLife>0;
    trails.visible=activeTrails>0;points.visible=activeParticles>0;root.visible=jetLife>0||activeTrails>0||activeParticles>0;
  },snapshot(){return {serial,activeTrails,activeParticles,jetLife,lastSurface,maxSegmentLength,visible:root.visible};},dispose(){
    if(disposed)return;disposed=true;root.visible=false;
    for(const resource of [trailGeometry,trailMaterial,jetGeometry,jetMaterial,particleGeometry,particleMaterial])resource.dispose();
    root.clear();
  }};
}
