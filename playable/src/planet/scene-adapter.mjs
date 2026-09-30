import {selectChunks,buildChunkSteps,createChunkCache,directionToCube} from './chunks.mjs';
import {add,scale,length,sub,unit,dot,tangentFrame,globalToLocal,createFloatingOrigin} from './coordinates.mjs';
import {enhancePlanetSurfaceMaterial} from '../planet-art/surface-material.mjs';
import {LEGACY_DITHER} from './high-altitude.mjs';
// Concept reference: docs/art/planet-v1/surface-transition-concept.png (art task d343).
// Muted basin stone, dry plains, forest, tidal mud and cool blue water.
const PALETTE={basin:[.24,.20,.25],plains:[.36,.33,.23],mountains:[.36,.34,.36],forest:[.14,.22,.15],wetland:[.22,.26,.20],river:[.16,.25,.31],coast:[.40,.38,.32],ocean:[.08,.17,.25],cliff:[.30,.28,.31]};
// The shader discards this convex region at blend 0. Require every Float32
// vertex, including skirts, to be strictly inside it with room for rounding.
export function fullyCoveredByLegacyMask(legacyXZ,halfSize){
  if(!(halfSize>0)||!legacyXZ?.length||legacyXZ.length%3)return false;
  const margin=Math.max(.001,halfSize*1e-6),inner=halfSize-margin;
  if(!(inner>0))return false;
  for(let i=0;i<legacyXZ.length;i+=3){const x=legacyXZ[i],z=legacyXZ[i+1],front=legacyXZ[i+2];
    if(!(Math.abs(x)<inner&&Math.abs(z)<inner&&front>margin))return false;
  }
  return true;
}
export function createPlanetTerrain({THREE:T,scene,field,material=null,lod={},segments=32,skirtDepth=80,capacity=384,renderFrame=tangentFrame(),autoRebase=false,floatingOrigin=createFloatingOrigin({origin:renderFrame.origin}),legacyMaskHalfSize=0}={}){
  if(!T?.BufferGeometry||!scene?.add||!field?.sample)throw new TypeError('THREE, scene and field required');
  const root=new T.Group();root.name='planet-terrain';scene.add(root);
  const ownedMaterial=!material;
  material??=new T.MeshStandardMaterial({vertexColors:true,roughness:.96,metalness:0});
  const waterMaterial=new T.MeshStandardMaterial({color:0x34546b,roughness:.3,metalness:.12,transparent:true,opacity:.83});
  waterMaterial.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float planetWaterDepth; varying float vPlanetWaterDepth;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPlanetWaterDepth=planetWaterDepth;');
    shader.fragmentShader='varying float vPlanetWaterDepth;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(vPlanetWaterDepth<0.02) discard;');
  };
  waterMaterial.customProgramCacheKey=()=> 'planet-water-depth-v1';
  const rotate=p=>({x:dot(p,renderFrame.east),y:dot(p,renderFrame.up),z:dot(p,renderFrame.south)});
  const render=p=>rotate(sub(p,floatingOrigin.origin));
  let legacyMaskEnabled=legacyMaskHalfSize>0;
  const legacyHalfUniform={value:legacyMaskHalfSize};
  const legacyBlendUniform={value:0};
  const refreshChunkVisibility=mesh=>{mesh.visible=!(legacyMaskEnabled&&legacyBlendUniform.value===0&&mesh.userData.fullyLegacyMasked&&mesh.children.length===0);};
  const refreshActiveVisibility=()=>{for(const mesh of root.children)refreshChunkVisibility(mesh);};
  // Opt-in ownership boundary: original six-kilometre PlaneGeometry remains sole basin surface.
  if(legacyMaskHalfSize){if(!ownedMaterial)throw new Error('Legacy masking requires adapter-owned material');
    material.onBeforeCompile=shader=>{
      shader.uniforms.planetLegacyHalf=legacyHalfUniform;
      shader.uniforms.planetLegacyBlend=legacyBlendUniform;
      shader.vertexShader='attribute vec3 planetLegacyXZ; varying vec3 vPlanetLegacyXZ;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPlanetLegacyXZ=planetLegacyXZ;');
      shader.fragmentShader='uniform float planetLegacyHalf; uniform float planetLegacyBlend; varying vec3 vPlanetLegacyXZ;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>\nif(vPlanetLegacyXZ.z>0.0 && max(abs(vPlanetLegacyXZ.x),abs(vPlanetLegacyXZ.y))<planetLegacyHalf && ${LEGACY_DITHER}>=planetLegacyBlend) discard;`);
    };
    material.customProgramCacheKey=()=> 'planet-legacy-mask-v1';
  }
  if(legacyMaskHalfSize)enhancePlanetSurfaceMaterial(material);
  function* load(c){const data=yield* buildChunkSteps(c,field,{segments,skirtDepth}),geometry=new T.BufferGeometry();
    let completed=false;
    try{
    const rotated=new Float32Array(data.positions.length),legacyXZ=new Float32Array(data.positions.length);
    for(let i=0;i<data.positions.length;i+=3){const p={x:data.positions[i],y:data.positions[i+1],z:data.positions[i+2]},r=rotate(p),legacy=globalToLocal({x:p.x+data.center.x,y:p.y+data.center.y,z:p.z+data.center.z},renderFrame);rotated.set([r.x,r.y,r.z],i);legacyXZ.set([legacy.x,legacy.z,legacy.y+field.planet.radius],i);}
    geometry.setAttribute('position',new T.BufferAttribute(rotated,3));geometry.setIndex(new T.BufferAttribute(data.indices,1));
    if(legacyMaskHalfSize)geometry.setAttribute('planetLegacyXZ',new T.BufferAttribute(legacyXZ,3));
    const colors=new Float32Array(data.positions.length),waterPositions=new Float32Array(data.positions.length),depths=new Float32Array(data.positions.length/3);
    for(let i=0;i<data.positions.length;i+=3){const sample=field.sample({x:data.center.x+data.positions[i],y:data.center.y+data.positions[i+1],z:data.center.z+data.positions[i+2]});
      for(const [id,w]of Object.entries(sample.biomes))for(let k=0;k<3;k++)colors[i+k]+=(PALETTE[id]?.[k]??.25)*w;
      depths[i/3]=sample.waterDepth??0;
      const point={x:data.center.x+data.positions[i],y:data.center.y+data.positions[i+1],z:data.center.z+data.positions[i+2]},water=rotate(sub(scale(unit(point),field.planet.radius+(sample.waterHeight??0)),data.center));waterPositions.set([water.x,water.y,water.z],i);
      // Legacy basin sampling can be much heavier than ordinary planet sampling.
      // Yield after each vertex so the caller's millisecond budget remains useful.
      yield;
    }
    geometry.setAttribute('color',new T.BufferAttribute(colors,3));
    // Skirt walls must not bend surface vertex normals into visible square outlines.
    geometry.setIndex(new T.BufferAttribute(data.indices.slice(0,data.surfaceIndexCount),1));geometry.computeVertexNormals();geometry.setIndex(new T.BufferAttribute(data.indices,1));geometry.computeBoundingSphere();
    const normals=geometry.getAttribute('normal');for(let i=(segments+1)**2;i<normals.count;i++){const normal=rotate(unit({x:data.center.x+data.positions[i*3],y:data.center.y+data.positions[i*3+1],z:data.center.z+data.positions[i*3+2]}));normals.setXYZ(i,normal.x,normal.y,normal.z);}
    const mesh=new T.Mesh(geometry,material);mesh.name=data.key;mesh.userData.planetChunk=data;
    mesh.userData.fullyLegacyMasked=fullyCoveredByLegacyMask(legacyXZ,legacyMaskHalfSize);
    const waterIndices=[];for(let i=0;i<data.surfaceIndexCount;i+=3){const a=data.indices[i],b=data.indices[i+1],c=data.indices[i+2];if(Math.max(depths[a],depths[b],depths[c])>.02)waterIndices.push(a,b,c);}
    if(waterIndices.length){const waterGeometry=new T.BufferGeometry();waterGeometry.setAttribute('position',new T.BufferAttribute(waterPositions,3));waterGeometry.setAttribute('planetWaterDepth',new T.BufferAttribute(depths,1));waterGeometry.setIndex(waterIndices);waterGeometry.computeVertexNormals();const waterMesh=new T.Mesh(waterGeometry,waterMaterial);waterMesh.name=data.key+'/water';mesh.add(waterMesh);}
    refreshChunkVisibility(mesh);completed=true;return mesh;
    }finally{if(!completed)geometry.dispose();}
  }
  const cache=createChunkCache({load,capacity,dispose:mesh=>{root.remove(mesh);mesh.geometry.dispose();for(const child of mesh.children)child.geometry.dispose();}});
  let selectionSignature='',destroyed=false,lastSelectionCamera=null,activeByKey=new Map(),selectedChunks=null,publishedRevision=0;
  const outsideLegacy=point=>{const o=globalToLocal(floatingOrigin.origin,renderFrame);return !legacyMaskEnabled||point.y+o.y < -field.planet.radius||Math.max(Math.abs(point.x+o.x),Math.abs(point.z+o.z))>=legacyMaskHalfSize;};
  const supportMesh=position=>{const tile=directionToCube(position);for(let level=lod.maxLevel??12;level>=0;level--){const n=2**level,mesh=activeByKey.get(`${tile.face}/${level}/${Math.min(n-1,Math.floor(tile.u*n))}/${Math.min(n-1,Math.floor(tile.v*n))}`);if(mesh)return mesh;}return null;};
  const api={root,floatingOrigin,field,get pending(){return cache.pending;},get revision(){return publishedRevision;},
    // Host switches old ground visibility in the same frame. No chunk rebuild or shader recompile.
    setLegacyMaskEnabled(enabled){if(destroyed)throw new Error('Planet terrain destroyed');if(enabled&&!legacyMaskHalfSize)throw new Error('Set legacyMaskHalfSize at creation to enable masking');const next=Boolean(enabled);if(legacyMaskEnabled===next)return;legacyMaskEnabled=next;legacyHalfUniform.value=legacyMaskEnabled?legacyMaskHalfSize:0;refreshActiveVisibility();},
    get legacyMaskEnabled(){return legacyMaskEnabled;},
    setLegacyBlend(value){const next=Math.max(0,Math.min(1,value));if(Object.is(legacyBlendUniform.value,next))return;legacyBlendUniform.value=next;refreshActiveVisibility();},
    update(cameraGlobal,work={}){if(destroyed)throw new Error('Planet terrain destroyed');
      const rebase=autoRebase?floatingOrigin.update(cameraGlobal):null;
      const surfaceRadius=field.planet.radius+field.sample(cameraGlobal).height,mesh=supportMesh(cameraGlobal);
      const needsGroundTile=Math.abs(length(cameraGlobal)-surfaceRadius)<=(lod.groundRange??100)&&(!mesh||2*Math.max(field.planet.radius,surfaceRadius)/(2**mesh.userData.planetChunk.chunk.level)/segments>(lod.groundSpacing??20));
      if((!cache.pending||!Number.isFinite(work.budgetMs))&&(!lastSelectionCamera||length(sub(cameraGlobal,lastSelectionCamera))>32||needsGroundTile)){
        const chunks=selectChunks(cameraGlobal,{radius:field.planet.radius,surfaceRadius,segments,...lod}),signature=chunks.map(c=>`${c.face}/${c.level}/${c.x}/${c.y}`).join(',');
        if(signature!==selectionSignature){selectedChunks=chunks;selectionSignature=signature;}
        lastSelectionCamera={...cameraGlobal};
      }
      if(selectedChunks){const meshes=cache.update(selectedChunks,work);if(cache.revision!==publishedRevision){root.clear();for(const mesh of meshes.values()){refreshChunkVisibility(mesh);root.add(mesh);}activeByKey=meshes;publishedRevision=cache.revision;selectedChunks=null;}}
      for(const mesh of root.children){const p=render(mesh.userData.planetChunk.center);mesh.position.set(p.x,p.y,p.z);}
      return {rebase,origin:floatingOrigin.origin,cameraRender:render(cameraGlobal),upRender:rotate(unit(cameraGlobal)),recommendedNear:Math.max(.1,(length(cameraGlobal)-field.planet.radius-4000)*.002),recommendedFar:Math.max(20000,length(cameraGlobal)+field.planet.radius*2),activeChunks:root.children.length,cachedChunks:cache.size};
    },
    // Exact current rendered triangle raycast. Skirts are never ground support.
    raycastSurface(raycaster){root.updateMatrixWorld(true);return raycaster.intersectObjects(root.children,false).filter(hit=>hit.faceIndex*3<hit.object.userData.planetChunk.surfaceIndexCount&&outsideLegacy(hit.point));},
    sampleRenderedSurface(canonical){
      const sample=field.sample(canonical),direction=unit(canonical);
      if(legacyMaskEnabled&&sample.legacyWeight===1)return {...sample,position:field.surfacePoint(canonical),ready:true,spacing:10,source:'legacy'};
      const from=render(scale(direction,field.planet.radius+10000)),down=rotate(scale(direction,-1));
      const mesh=supportMesh(canonical);
      // Cube UV locates the exact surface triangle in O(1). Intersect its plane directly:
      // general Raycaster edge tests can reject an exact polar/grid vertex after Float32 rounding.
      let hit=null;
      if(mesh){const tile=directionToCube(canonical),chunk=mesh.userData.planetChunk.chunk,n=2**chunk.level;
        const gx=Math.max(0,Math.min(segments,(tile.u*n-chunk.x)*segments)),gy=Math.max(0,Math.min(segments,(tile.v*n-chunk.y)*segments));
        const ix=Math.min(segments-1,Math.floor(gx)),iy=Math.min(segments-1,Math.floor(gy)),triangle=(iy*segments+ix)*6+(gx-ix+gy-iy<=1?0:3);
        const indices=mesh.geometry.index,positions=mesh.geometry.getAttribute('position');
        const vertex=offset=>{const i=indices.getX(triangle+offset);return {x:positions.getX(i)+mesh.position.x,y:positions.getY(i)+mesh.position.y,z:positions.getZ(i)+mesh.position.z};};
        const a=vertex(0),ab=sub(vertex(1),a),ac=sub(vertex(2),a),normal={x:ab.y*ac.z-ab.z*ac.y,y:ab.z*ac.x-ab.x*ac.z,z:ab.x*ac.y-ab.y*ac.x};
        const denominator=dot(normal,down),distance=dot(normal,sub(a,from))/denominator;
        if(Number.isFinite(distance)&&distance>=0&&distance<=20000){const point=add(from,scale(down,distance));if(outsideLegacy(point))hit={point,object:mesh};}
      }
      if(!hit)return {...sample,ready:false,position:null,source:'unloaded'};
      const position=add(floatingOrigin.origin,add(scale(renderFrame.east,hit.point.x),add(scale(renderFrame.up,hit.point.y),scale(renderFrame.south,hit.point.z)))),height=length(position)-field.planet.radius;
      const spacing=field.planet.radius*2/(2**hit.object.userData.planetChunk.chunk.level)/segments;
      return {...sample,height,position,spacing,ready:true,source:'triangles',waterDepth:sample.waterHeight===null?0:Math.max(0,sample.waterHeight-height)};
    },
    isReady(canonical,maxSpacing=20){const sample=api.sampleRenderedSurface(canonical);return sample.ready&&sample.spacing<=maxSpacing;},
    destroy(){if(destroyed)return;destroyed=true;cache.destroy();scene.remove(root);waterMaterial.dispose();if(ownedMaterial)material.dispose();}
  };
  return api;
}
