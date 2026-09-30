import * as T from 'three';

// Local ambient contact only, not a substitute for the original light's projected shadow.
export function createContactPatches(anchor,terrainHeight){
  const root=new T.Group();root.name='creature-ground-contact';anchor.add(root);
  const patches=Array.from({length:5},()=>{
    const geometry=new T.PlaneGeometry(1,1,6,6);geometry.rotateX(-Math.PI/2);
    const material=new T.ShaderMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,uniforms:{strength:{value:.15}},
      vertexShader:'varying vec2 vContactUv; void main(){vContactUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'varying vec2 vContactUv; uniform float strength; void main(){float r=length((vContactUv-.5)*2.);float a=(1.-smoothstep(.15,1.,r))*strength;gl_FragColor=vec4(.015,.012,.020,a);}' });
    const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;mesh.visible=false;mesh.renderOrder=1;root.add(mesh);return mesh;
  });
  const point=new T.Vector3(),center=new T.Vector3();
  function hide(){patches.forEach(p=>p.visible=false);}
  function put(index,worldPoint,{lift=0,corpse=false}={}){
    const patch=patches[index];patch.visible=true;center.copy(worldPoint);anchor.worldToLocal(center);
    const p=patch.geometry.attributes.position,uv=patch.geometry.attributes.uv;
    const width=corpse?.55:.27,length=corpse?.7:.40;
    for(let i=0;i<p.count;i++){point.set(center.x+(uv.getX(i)-.5)*width,0,center.z-(uv.getY(i)-.5)*length);anchor.localToWorld(point);point.y=terrainHeight(point.x,point.z)+.007;anchor.worldToLocal(point);p.setXYZ(i,point.x,point.y,point.z);}p.needsUpdate=true;
    patch.material.uniforms.strength.value=corpse?.19:.17*Math.max(.15,1-lift/.09);
  }
  return {root,hide,put,mount(nextAnchor){anchor=nextAnchor;anchor.add(root);},dispose(){patches.forEach(p=>{p.geometry.dispose();p.material.dispose();});anchor.remove(root);}};
}
