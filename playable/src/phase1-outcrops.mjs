// Basalt escarpment study based on phase1-v1/map-concept.png.
// No random global state; collision footprint and rendered mesh share one record.
const TAU = Math.PI * 2;
const SITES = [
  [-62, 40, 10.8, 13.5, 0.22],
  [66, -48, 8.5, 9.8, 1.1],
  [-66, -120, 11.2, 16, 0.5],
  [64, -245, 10.4, 14.8, -0.4],
  [-70, -330, 11.8, 12.5, 0.8],
  [100, -400, 11.5, 16, 0.1],
  [-105, -590, 10.5, 13.8, 1.4],
];
const RINGS = [
  [-0.25, 1.00], [0.07, 0.93], [0.17, 0.78], [0.21, 0.77],
  [0.47, 0.75], [0.49, 0.69], [0.71, 0.68], [0.74, 0.62], [1.00, 0.61],
];
const hash = (n) => { const v=Math.sin(n*127.1+311.7)*43758.5453123;return v-Math.floor(v); };

/** Local geometry y is measured from the base; place each vertex on the shared
 * terrain height at its own world x/z (then add local y). This prevents floating
 * footings on sloped ground. Radius encloses the complete collision footprint.
 * Faces have independent vertices for sharp fractured normals. meshColors are
 * optional linear RGB attributes. All eight footprint points are CCW in x/z.
 */
export function createPhase1Outcrops() {
  return SITES.map(([x,z,radius,height,rotation], siteIndex) => {
    const vertices=Array.from({length:8},(_,i)=>{
      const a=rotation+i*TAU/8;
      return {x:Math.cos(a)*radius,z:Math.sin(a)*radius*.78};
    });
    const rings=RINGS.map(([rise,scale], ringIndex)=>Array.from({length:32},(_,j)=>{
      const edge=Math.floor(j/4), t=(j%4)/4;
      const a=vertices[edge],b=vertices[(edge+1)%8];
      // Paired column facets with deep, irregular vertical joints. The base
      // stays convex and the upper body retreats inside that shared footprint.
      const joint=j%4===1 ? .13+hash(siteIndex*91+j)*.08 : 0;
      const fractured=ringIndex===0 ? 1 : 1-joint-(hash(j*17+siteIndex*53)-.5)*.035;
      const lean=ringIndex===0?0:Math.sin(j*.74+siteIndex)*.018*ringIndex/8;
      const px=(a.x+(b.x-a.x)*t)*(scale*fractured+lean);
      const pz=(a.z+(b.z-a.z)*t)*(scale*fractured+lean);
      const brokenTop=.83+.17*hash(Math.floor(j/2)*7+siteIndex*53);
      const y=ringIndex===0 ? rise : height*rise*(ringIndex===8?brokenTop:1)
        +(hash(j*5+siteIndex*13)-.5)*height*.025;
      return [px,y,pz];
    }));
    const meshPositions=[],meshIndices=[],meshColors=[];
    const face=(a,b,c,layer,faceIndex)=>{
      const start=meshPositions.length/3;
      meshPositions.push(...a,...b,...c);meshIndices.push(start,start+1,start+2);
      // Avoid painted horizontal bands: very subtle bedding, with most colour
      // variation coming from fractured faces and the world-space rock image.
      const bedding=[.98,.99,1.00,.99,1.00,.98,1.01,.99,1.01][layer];
      const tone=bedding*(.965+hash(faceIndex+siteIndex*311)*.07);
      for(let k=0;k<3;k++)meshColors.push(.205*tone,.187*tone,.194*tone);
    };
    for(let r=0;r<rings.length-1;r++)for(let j=0;j<32;j++){
      const next=(j+1)%32,a=rings[r][j],b=rings[r][next],c=rings[r+1][j],d=rings[r+1][next];
      face(a,c,b,r,r*71+j);face(b,c,d,r,r*71+j);
    }
    // Broken tilted mesa cap: no conical apex. Fan centre is below the tallest
    // rim so the silhouette reads as a sheared cliff rather than a pyramid.
    const top=[radius*.04,height*.85,-radius*.025];
    for(let j=0;j<32;j++){
      face(top,rings[8][(j+1)%32],rings[8][j],8,1000+j);
      face([0,-.25,0],rings[0][j],rings[0][(j+1)%32],0,1100+j);
    }
    return {id:`phase1-basalt-${siteIndex+1}`,x,z,radius,height,vertices,shade:1,
      solid:true,kind:'basalt-outcrop',meshPositions,meshIndices,meshColors};
  });
}
