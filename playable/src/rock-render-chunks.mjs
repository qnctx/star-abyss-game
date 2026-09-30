import * as THREE from 'three';

// A 256m trial doubled draw calls on the integrated/software path. Larger
// batches retain useful frustum rejection without hundreds of submissions.
export const ROCK_RENDER_CHUNK_SIZE = 768;

// The physics field is immutable input. Only submission batches change: every
// rock keeps its original world-space vertices, indexed faces and vertex colour.
export function createRockRenderChunks(rocks, terrainHeight, material, chunkSize = ROCK_RENDER_CHUNK_SIZE) {
  if(!Number.isFinite(chunkSize)||chunkSize<=0)throw new RangeError('Rock render chunk size must be positive');
  const batches=new Map();
  rocks.forEach((rock,rockIndex)=>{
    const key=`${Math.floor(rock.x/chunkSize)},${Math.floor(rock.z/chunkSize)}`;
    if(!batches.has(key))batches.set(key,{positions:[],colors:[],indices:[],rockIndices:[]});
    const batch=batches.get(key),start=batch.positions.length/3,n=rock.vertices.length;
    batch.rockIndices.push(rockIndex);
    if(rock.meshPositions){
      for(let i=0;i<rock.meshPositions.length;i+=3){const x=rock.x+rock.meshPositions[i],z=rock.z+rock.meshPositions[i+2];batch.positions.push(x,terrainHeight(x,z)+rock.meshPositions[i+1],z);batch.colors.push(...rock.meshColors.slice(i,i+3));}
      for(const index of rock.meshIndices)batch.indices.push(start+index);
      return;
    }
    // Copy the original three-ring profile exactly, including its terrain-buried
    // base. A crossing rock belongs wholly to one cell: never cut a rock in half.
    for(const [scale,rise] of [[1,0],[1,.32],[.43,.88]])for(const vertex of rock.vertices) {
      const x=rock.x+vertex.x*scale,z=rock.z+vertex.z*scale;
      batch.positions.push(x,terrainHeight(x,z)-.015+rock.height*rise,z);
      const shade=.13+rock.shade*.07+rise*.04;
      batch.colors.push(...(rock.kind==='meteor'?[shade*1.22,shade*1.12,shade*1.06]:[shade,shade*.96,shade*1.10]));
    }
    batch.positions.push(rock.x,terrainHeight(rock.x,rock.z)+rock.height,rock.z);batch.colors.push(.21,.20,.23);
    for(let i=0;i<n;i++) {
      const next=(i+1)%n;
      for(let layer=0;layer<2;layer++) {
        const a=start+layer*n+i,b=start+layer*n+next,c=start+(layer+1)*n+i,d=start+(layer+1)*n+next;
        batch.indices.push(a,c,b,b,c,d);
      }
      batch.indices.push(start+2*n+i,start+3*n,start+2*n+next);
    }
  });
  const group=new THREE.Group();group.name='physical-rock-field';
  group.userData={rockCount:rocks.length,chunkSize,chunkCount:batches.size};
  for(const [key,batch] of batches) {
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(batch.positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(batch.colors,3));geometry.setIndex(batch.indices);
    // Vertices are not shared between rocks, so computing normals per spatial
    // batch produces the identical normal stream as the old whole-field mesh.
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,material);mesh.name=`physical-rock-field:${key}`;
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=true;
    mesh.userData={cell:key,rockIndices:batch.rockIndices};group.add(mesh);
  }
  return group;
}
