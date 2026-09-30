// Reuse the existing expedition-world mineral/moss patch geometry and materials.
// This renderer adds no new asset design, and never uses a box as a landmark.
export function createExplorationVisual({THREE:T,scene,toLocal,upLocal}){
 const root=new T.Group();root.name='exploration-content';scene.add(root);
 const stone=new T.MeshStandardMaterial({color:'#4d4550',roughness:.92,metalness:.2});
 const ore=new T.MeshStandardMaterial({color:'#756c73',roughness:.92,metalness:.65});
 const moss=new T.MeshStandardMaterial({color:'#597b78',roughness:.92,metalness:.2});
 const glow=new T.MeshStandardMaterial({color:'#b77d4b',emissive:'#bd692b',emissiveIntensity:.7});
 const dew=new T.MeshStandardMaterial({color:'#82bbc1',emissive:'#346a70',emissiveIntensity:.45});
 const sphere=new T.SphereGeometry(1,10,6),shard=new T.DodecahedronGeometry(1,0),groups=new Map();
 const mesh=(g,geo,mat,x,y,z,sx,sy,sz)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);g.add(m);return m;};
 function update(records,support,player){
  root.visible=!!player;if(!player)return;
  for(const d of records){
   if(!d.quantity)continue;let g=groups.get(d.id);
   if(!g){g=new T.Group();g.name=d.id;root.add(g);groups.set(d.id,g);
    for(let i=0;i<7;i++){const angle=i*2.39996,r=.12+i*.09,x=Math.cos(angle)*r,z=Math.sin(angle)*r;
     mesh(g,shard,stone,x,.04,z,.32,.055,.27);
     mesh(g,shard,d.kind==='herb'?moss:ore,x,.085,z,.19,.09,.14).rotation.y=angle;
     mesh(g,sphere,d.kind==='herb'?dew:glow,x,.15,z,.045,.025,.045);
    }
   }
   const near=Math.hypot(player.x-d.position.x,player.y-d.position.y,player.z-d.position.z)<220;
   const s=near?support(d):null;g.visible=!!s?.ready&&d.remaining>0;
   if(g.visible){const p=toLocal(s.position),u=upLocal(s.position);g.position.set(p.x,p.y,p.z);g.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(u.x,u.y,u.z).normalize());}
  }
 }
 return {root,update,dispose(){scene.remove(root);root.clear();sphere.dispose();shard.dispose();for(const m of [stone,ore,moss,glow,dew])m.dispose();}};
}
