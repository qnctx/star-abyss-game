// Geography is sampled from the authoritative world field. Paper is decorative only.
export const MAP_PAPER='assets/maps/atlas-paper-v1.png';
const COLORS={basin:[184,164,134],plains:[181,186,130],mountains:[149,130,109],forest:[105,143,108],wetland:[131,162,145],river:[121,164,174],coast:[209,197,150],ocean:[131,169,184],cliff:[136,117,102]};
export const BIOME_LABELS={basin:'裂环盆地',plains:'平原草地',mountains:'山脉',forest:'森林',wetland:'湿地',river:'河谷',coast:'海岸',ocean:'海洋',cliff:'崖地'};
const round=n=>Number(n.toFixed(2));
function rasterURI(colors,columns,rows){
  // Standard lossless 24-bit BMP avoids DOM/canvas dependencies and runtime encoding libraries.
  const stride=Math.ceil(columns*3/4)*4,bytes=new Uint8Array(54+stride*rows),view=new DataView(bytes.buffer);
  bytes[0]=66;bytes[1]=77;view.setUint32(2,bytes.length,true);view.setUint32(10,54,true);view.setUint32(14,40,true);
  view.setInt32(18,columns,true);view.setInt32(22,-rows,true);view.setUint16(26,1,true);view.setUint16(28,24,true);
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const p=colors[y*columns+x],i=54+y*stride+x*3;bytes[i]=p[2];bytes[i+1]=p[1];bytes[i+2]=p[0];}
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return 'data:image/bmp;base64,'+btoa(binary);
}
export function contourPath(values,columns,rows,level,width,height){
  const segments=[];
  for(let y=0;y<rows-1;y++)for(let x=0;x<columns-1;x++){
    const corners=[[x,y,values[y*columns+x]],[x+1,y,values[y*columns+x+1]],[x+1,y+1,values[(y+1)*columns+x+1]],[x,y+1,values[(y+1)*columns+x]]],hits=[];
    for(let edge=0;edge<4;edge++){
      const a=corners[edge],b=corners[(edge+1)%4];if((a[2]<level)===(b[2]<level))continue;
      const t=(level-a[2])/(b[2]-a[2]);hits.push([round((a[0]+t*(b[0]-a[0])+.5)*width/columns),round((a[1]+t*(b[1]-a[1])+.5)*height/rows)]);
    }
    for(let i=0;i+1<hits.length;i+=2)segments.push(`M${hits[i].join(',')}L${hits[i+1].join(',')}`);
  }
  return segments.join('');
}
export function createCartography({sample,columns=240,rows=120,width=960,height=480,levels=[100,300,600,1000,1800,2600],labels=true,reliefStrength=.055}={}){
  if(typeof sample!=='function'||![columns,rows,width,height].every(Number.isFinite)||!Number.isInteger(columns)||!Number.isInteger(rows)||columns<2||rows<2||columns*rows>131072||width<=0||height<=0)throw new TypeError('Bounded geography sampler required');
  const samples=[],heights=[],water=[];
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
    const s=sample((x+.5)/columns,(y+.5)/rows);
    if(!Number.isFinite(s.height))throw new TypeError('Map requires finite terrain height');
    if(!Object.entries(s.biomes??{}).some(([id,w])=>COLORS[id]&&w>0&&Number.isFinite(w)))throw new TypeError('Map requires actual biome weights');
    samples.push(s);heights.push(s.height);water.push(s.waterDepth>0?1:0);
  }
  const colors=samples.map((s,i)=>{
    const color=[0,0,0];let total=0;
    for(const [id,w]of Object.entries(s.biomes)){if(!COLORS[id]||!Number.isFinite(w)||w<=0)continue;total+=w;for(let k=0;k<3;k++)color[k]+=COLORS[id][k]*w;}
    const wet=s.waterDepth>0,base=wet?COLORS.ocean:color.map(v=>v/total);
    const x=i%columns,y=Math.floor(i/columns),dx=heights[y*columns+Math.min(columns-1,x+1)]-heights[y*columns+Math.max(0,x-1)],dy=heights[Math.min(rows-1,y+1)*columns+x]-heights[Math.max(0,y-1)*columns+x];
    const shade=wet?Math.max(-18,-Math.log1p(s.waterDepth)*2):Math.max(-35,Math.min(30,(-dx-dy)*reliefStrength));
    return base.map(v=>Math.max(0,Math.min(255,Math.round(v+shade))));
  });
  const contour=levels.map(level=>`<path data-elevation="${level}" d="${contourPath(heights,columns,rows,level,width,height)}"/>`).join('');
  const coast=contourPath(water,columns,rows,.5,width,height);
  const named=[],positions=[];
  if(labels)for(const [id,name]of Object.entries(BIOME_LABELS)){
    let best=null;
    samples.forEach((s,i)=>{const weight=s.biomes[id]||0,x=(i%columns+.5)/columns*width,y=(Math.floor(i/columns)+.5)/rows*height;
      if(weight<.42||x<65||x>width-65||y<30||y>height-30||positions.some(p=>Math.hypot(p.x-x,p.y-y)<85))return;
      const score=weight-(Math.abs(x-width/2)/width+Math.abs(y-height/2)/height)*.015;
      if(!best||score>best.score)best={id,name,x,y,score,weight};});
    if(best){named.push(best);positions.push(best);}
  }
  const text=named.map(p=>`<text x="${round(p.x)}" y="${round(p.y)}" text-anchor="middle" data-biome="${p.id}">${p.name}</text>`).join('');
  const svg=`<image width="${width}" height="${height}" preserveAspectRatio="none" href="${MAP_PAPER}"/><image data-cartography="terrain" width="${width}" height="${height}" preserveAspectRatio="none" opacity=".87" href="${rasterURI(colors,columns,rows)}"/><g fill="none" stroke="#695c46" stroke-opacity=".3" stroke-width=".65" vector-effect="non-scaling-stroke">${contour}</g><path data-cartography="coast" d="${coast}" fill="none" stroke="#4c7375" stroke-width="1.1" opacity=".75"/><g font-size="12" font-family="Georgia,serif" fill="#344437" stroke="#e5d9b9" stroke-width="3" paint-order="stroke" letter-spacing="2">${text}</g>`;
  return Object.freeze({svg,labels:named.map(({id,name,x,y,weight})=>({id,name,x,y,weight})),columns,rows,sampleCount:samples.length});
}
