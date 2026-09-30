import * as THREE from 'three';

// Four 512px maps, generated once. Material detail has no per-frame canvas work,
// extra lights, transparent layers or per-crack meshes.
export function createExplorerSurfaceMaps() {
  const size=512,textures=[];
  let seed=0x435832;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const canvas=()=>{const c=document.createElement('canvas');c.width=c.height=size;return c;};
  const fabric=canvas(),mineral=canvas(),fabricHeight=canvas(),mineralHeight=canvas();
  const cloth=fabric.getContext('2d'),stone=mineral.getContext('2d');
  const ch=fabricHeight.getContext('2d'),sh=mineralHeight.getContext('2d');
  const image=cloth.createImageData(size,size),height=ch.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const index=(y*size+x)*4,thread=((x+(y%4<2?2:0))%4<2?1:-1)*5;
    const grain=(random()-.5)*13;
    const fold=Math.sin(y*.065+Math.sin(x*.029)*2.2)*3+Math.sin(y*.026-x*.044)*2;
    image.data[index]=119+grain+thread+fold;image.data[index+1]=111+grain+thread+fold;image.data[index+2]=97+grain+thread+fold;image.data[index+3]=255;
    height.data[index]=height.data[index+1]=height.data[index+2]=128+thread*3+grain*.5+fold*2;height.data[index+3]=255;
  }
  cloth.putImageData(image,0,0);ch.putImageData(height,0,0);
  // Broad, double-stitched diagonal panels read at gameplay distance; the weave
  // takes over close up. These are cloth seams, not glowing mechanical piping.
  for(let offset=-size;offset<size*2;offset+=172) {
    for(const [ctx,color,width,shift] of [[cloth,'#514b41',3,0],[cloth,'#a99d87',1,4],[ch,'#777777',3,0]]) {
      ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(offset,0);ctx.lineTo(offset+size*.55+shift,size);ctx.stroke();
    }
    cloth.strokeStyle='#c0b49d';cloth.lineWidth=1;cloth.setLineDash([3,5]);cloth.beginPath();cloth.moveTo(offset+6,0);cloth.lineTo(offset+size*.55+6,size);cloth.stroke();cloth.setLineDash([]);
  }
  stone.fillStyle='#ded8c8';stone.fillRect(0,0,size,size);sh.fillStyle='#bcbcbc';sh.fillRect(0,0,size,size);
  const sites=[];
  for(let y=-1;y<7;y++)for(let x=-1;x<7;x++)sites.push({x:(x+.2+random()*.6)*86,y:(y+.2+random()*.6)*86,tone:random()});
  // A bounded Voronoi mineral grain: real branching cell boundaries, not a
  // repeated diagonal scratch pattern. Patches share one closed fracture line.
  for(const site of sites) {
    let polygon=[[-86,-86],[598,-86],[598,598],[-86,598]];
    for(const other of sites) {
      if(other===site)continue;
      const nx=other.x-site.x,ny=other.y-site.y,c=(other.x**2+other.y**2-site.x**2-site.y**2)/2,next=[];
      for(let i=0;i<polygon.length;i++) {
        const a=polygon[i],b=polygon[(i+1)%polygon.length],da=a[0]*nx+a[1]*ny-c,db=b[0]*nx+b[1]*ny-c;
        if(da<=0)next.push(a);
        if((da<=0)!==(db<=0)){const t=da/(da-db);next.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
      }
      polygon=next;if(!polygon.length)break;
    }
    if(!polygon.length)continue;
    for(const ctx of [stone,sh]){ctx.beginPath();polygon.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();}
    const tone=Math.floor(site.tone*19);stone.fillStyle=`rgb(${214+tone},${208+tone},${191+tone})`;stone.fill();
    stone.strokeStyle='#807363';stone.lineWidth=2.4;stone.stroke();stone.strokeStyle='#b69b6d';stone.lineWidth=.75;stone.stroke();
    sh.fillStyle=`rgb(${181+tone},${181+tone},${181+tone})`;sh.fill();sh.strokeStyle='#4f4f4f';sh.lineWidth=2.6;sh.stroke();
  }
  // Fine inclusions keep each broad stone patch from looking like flat plastic.
  for(let i=0;i<1800;i++){const x=random()*size,y=random()*size;stone.fillStyle=i%3?'rgba(92,84,68,.16)':'rgba(255,253,232,.36)';stone.fillRect(x,y,.6+random()*1.4,.6+random()*1.5);}
  const texture=(source,color)=>{const t=new THREE.CanvasTexture(source);if(color)t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;textures.push(t);return t;};
  return {weave:texture(fabric,true),stone:texture(mineral,true),weaveHeight:texture(fabricHeight,false),stoneHeight:texture(mineralHeight,false),textures};
}
