import * as THREE from 'three';

// Visual probe, not a damage volume or a promise of through-wall detection.
export const SCAN = Object.freeze({ duration: 5, cooldown: 8, radius: 160 });

export function createScanState() {
  return { active:false, remaining:0, time:0, origin:{x:0,y:0,z:0}, radius:0, opacity:0 };
}
export function updateScanState(state,remaining,time,origin) {
  const rest=Number.isFinite(remaining)?Math.max(0,Math.min(SCAN.duration,remaining)):0;
  if(rest<=0 || !Number.isFinite(time) || time<state.time){
    Object.assign(state,{active:false,remaining:0,radius:0,opacity:0,time:Number.isFinite(time)?time:0});return state;
  }
  if(!state.active || rest>state.remaining+.001) state.origin={...origin};
  state.active=true;state.remaining=rest;state.time=time;
  const progress=1-rest/SCAN.duration;
  state.radius=.4+SCAN.radius*progress;
  state.opacity=Math.min(1,progress/.035)*Math.min(1,(1-progress)/.22);
  return state;
}

export function createScanEffect() {
  const state=createScanState(),root=new THREE.Group();root.name='world-scan-pulse';
  const geometry=new THREE.SphereGeometry(1,64,32);
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,
    uniforms:{fade:{value:0}},
    vertexShader:'varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);v=-p.xyz;gl_Position=projectionMatrix*p;}',
    fragmentShader:'uniform float fade;varying vec3 n;varying vec3 v;void main(){float rim=pow(1.0-abs(dot(normalize(n),normalize(v))),3.0);gl_FragColor=vec4(0.22,0.82,0.92,fade*(0.008+rim*0.10));}'});
  const wave=new THREE.Mesh(geometry,material);root.add(wave);
  // Horizontal latitude mesh is world-space and depth tested, never glued to camera.
  const ringGeometry=new THREE.TorusGeometry(1,.002,6,128);
  const ringMaterial=new THREE.MeshBasicMaterial({color:0x70e3ef,transparent:true,opacity:0,depthWrite:false});
  const ring=new THREE.Mesh(ringGeometry,ringMaterial);ring.rotation.x=-Math.PI/2;root.add(ring);
  root.visible=false;
  return {root,update(remaining,time,origin){
    updateScanState(state,remaining,time,origin);root.visible=state.active;
    if(!state.active)return;
    root.position.set(state.origin.x,state.origin.y,state.origin.z);
    wave.scale.setScalar(state.radius);ring.scale.setScalar(state.radius);
    material.uniforms.fade.value=state.opacity;ringMaterial.opacity=state.opacity*.4;
  },snapshot:()=>({...state,origin:{...state.origin}}),dispose(){geometry.dispose();material.dispose();ringGeometry.dispose();ringMaterial.dispose();}};
}
