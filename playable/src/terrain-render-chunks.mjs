/** Split an indexed PlaneGeometry grid into independently culled draw meshes.
 * Positions and every vertex attribute are copied verbatim; normals are never
 * regenerated at chunk seams. The caller retains ownership of the source and
 * shared material. Dispose each returned child's geometry with the scene.
 */
export function createTerrainRenderChunks(THREE, source, material, segments = 600, chunkCells = 50) {
  if (!Number.isInteger(segments) || segments < 1 || !Number.isInteger(chunkCells) || chunkCells < 1
    || !source?.index || source.index.count !== segments * segments * 6
    || source.attributes?.position?.count !== (segments + 1) ** 2) {
    throw new TypeError('Expected an indexed square PlaneGeometry grid and positive integer cell counts');
  }
  const attributes=Object.entries(source.attributes), rowSize=segments+1;
  if(attributes.some(([,a])=>a.count!==rowSize**2))throw new TypeError('Terrain attributes must share the full grid');
  const root=new THREE.Group();root.name='legacy-terrain-chunks';
  for(let z=0;z<segments;z+=chunkCells)for(let x=0;x<segments;x+=chunkCells){
    const width=Math.min(chunkCells,segments-x),depth=Math.min(chunkCells,segments-z),stride=width+1;
    const geometry=new THREE.BufferGeometry();
    for(const [name,attribute] of attributes){
      const original=attribute.isInterleavedBufferAttribute?attribute.data.array:attribute.array;
      const array=new original.constructor(stride*(depth+1)*attribute.itemSize);
      for(let v=0;v<=depth;v++)for(let u=0;u<=width;u++){
        const sourceIndex=(z+v)*rowSize+x+u,localIndex=v*stride+u;
        const start=attribute.isInterleavedBufferAttribute?sourceIndex*attribute.data.stride+attribute.offset:sourceIndex*attribute.itemSize;
        for(let c=0;c<attribute.itemSize;c++)array[localIndex*attribute.itemSize+c]=original[start+c];
      }
      const copied=new THREE.BufferAttribute(array,attribute.itemSize,attribute.normalized);
      copied.name=attribute.name;copied.setUsage(attribute.usage??attribute.data?.usage??THREE.StaticDrawUsage);
      if(attribute.gpuType!==undefined)copied.gpuType=attribute.gpuType;
      geometry.setAttribute(name,copied);
    }
    const Indices=stride*(depth+1)>65535?Uint32Array:Uint16Array,indices=new Indices(width*depth*6);
    let target=0;
    for(let v=0;v<depth;v++)for(let u=0;u<width;u++)for(let corner=0;corner<6;corner++){
      const sourceIndex=source.index.getX(((z+v)*segments+x+u)*6+corner);
      const localX=sourceIndex%rowSize-x,localZ=Math.floor(sourceIndex/rowSize)-z;
      if(localX<0||localX>width||localZ<0||localZ>depth){geometry.dispose();throw new TypeError('Triangle topology does not match the PlaneGeometry grid');}
      indices[target++]=localZ*stride+localX;
    }
    geometry.setIndex(new THREE.BufferAttribute(indices,1));geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,material);mesh.name=`terrain-${x}-${z}`;
    mesh.receiveShadow=true;mesh.castShadow=false;mesh.frustumCulled=true;
    mesh.userData.terrainCells={x,z,width,depth};root.add(mesh);
  }
  root.userData.terrainChunks={segments,chunkCells,triangles:segments*segments*2,count:root.children.length};
  return root;
}
