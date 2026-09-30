/** Palm-origin pulse. Fixed buffers, no per-frame geometry/material creation. */
export function createPulseEffects({THREE,scene}) {
  const group=new THREE.Group();group.name='expedition-player-pulse';group.visible=false;scene.add(group);
  const segments=32,positions=new Float32Array((segments+1)*2*3),indices=[];
  for(let i=0;i<segments;i++){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(indices);
  const material=new THREE.MeshBasicMaterial({color:0xa9f8ff,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
  const arc=new THREE.Mesh(geometry,material);arc.frustumCulled=false;group.add(arc);
  const sparkPositions=new Float32Array(48*3),sparkGeometry=new THREE.BufferGeometry();sparkGeometry.setAttribute('position',new THREE.BufferAttribute(sparkPositions,3));
  const sparkMaterial=new THREE.PointsMaterial({color:0xd2ffff,size:.026,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
  const sparks=new THREE.Points(sparkGeometry,sparkMaterial);sparks.frustumCulled=false;group.add(sparks);
  let castId=null,wasReleased=false;const origin=new THREE.Vector3();
  return {update(view,palm){
    const cast=view?.playerCast,t=(view?.time??0)-(cast?.start??0),wind=(cast?.due??0)-(cast?.start??0);
    group.visible=!!cast&&!cast.kind&&view.screen==='playing'&&view.time<cast.end&&t>=0;
    if(!group.visible)return;
    const released=t>=wind,progress=released?Math.min(1,(t-wind)/.26):Math.max(0,t/Math.max(.001,wind));
    if(castId!==cast.castId)wasReleased=false;
    if(!released||!wasReleased){if(palm)origin.copy(palm);else origin.set(view.player.x,view.player.y+1.2,view.player.z);}
    castId=cast.castId;wasReleased=released;
    group.position.copy(origin);group.rotation.y=cast.yaw;
    const radius=released?.18+progress*3.5:.09+.11*progress,width=released?.02+.07*(1-progress):.018;
    for(let i=0;i<=segments;i++){const angle=-.72+i/segments*1.44;for(let j=0;j<2;j++){const r=radius+(j?width:0),k=(i*2+j)*3;positions[k]=Math.sin(angle)*r;positions[k+1]=Math.sin(i/segments*Math.PI)*.06;positions[k+2]=-Math.cos(angle)*r;}}
    geometry.attributes.position.needsUpdate=true;
    material.opacity=released?.7*(1-progress):.12+.35*progress;
    for(let i=0;i<48;i++){const angle=-.7+(i%16)/15*1.4,r=radius*(.72+(i%3)*.11),k=i*3;sparkPositions[k]=Math.sin(angle)*r;sparkPositions[k+1]=(Math.sin(i*2.399)*.13)*(released?progress:0);sparkPositions[k+2]=-Math.cos(angle)*r;}
    sparkGeometry.attributes.position.needsUpdate=true;sparkMaterial.opacity=released?.65*(1-progress):.2*progress;
  },destroy(){scene.remove(group);geometry.dispose();sparkGeometry.dispose();material.dispose();sparkMaterial.dispose();}};
}
