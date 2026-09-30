const test=require('node:test');
const assert=require('node:assert/strict');
const modules=Promise.all([import('three'),import('../src/rock-render-chunks.mjs'),import('../src/layout.mjs')]);

// Frozen reference of the pre-chunk renderer. Keeping this independent catches
// changes to terrain planting, meteor colours, winding and smooth normals.
function legacyGeometry(THREE,rocks,terrainHeight) {
  const positions=[],colors=[],indices=[];
  for(const rock of rocks) {
    const start=positions.length/3;
    for(const [scale,rise] of [[1,0],[1,.32],[.43,.88]])for(const vertex of rock.vertices) {
      const x=rock.x+vertex.x*scale,z=rock.z+vertex.z*scale;
      positions.push(x,terrainHeight(x,z)-.015+rock.height*rise,z);
      const shade=.13+rock.shade*.07+rise*.04;
      colors.push(...(rock.kind==='meteor'?[shade*1.22,shade*1.12,shade*1.06]:[shade,shade*.96,shade*1.10]));
    }
    positions.push(rock.x,terrainHeight(rock.x,rock.z)+rock.height,rock.z);colors.push(.21,.20,.23);
    for(let i=0;i<8;i++) {
      const next=(i+1)%8;
      for(let layer=0;layer<2;layer++){
        const a=start+layer*8+i,b=start+layer*8+next,c=start+(layer+1)*8+i,d=start+(layer+1)*8+next;
        indices.push(a,c,b,b,c,d);
      }
      indices.push(start+16+i,start+24,start+16+next);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

test('rock chunks preserve every original world vertex, colour, normal and triangle within a bounded batch count',async()=>{
  const [THREE,{createRockRenderChunks},{ROCK_FIELD:field,terrainHeight}]=await modules;
  const ROCK_FIELD={rocks:field.rocks.filter(r=>!r.meshPositions)};
  const original=JSON.stringify(ROCK_FIELD.rocks),material=new THREE.MeshStandardMaterial();
  const group=createRockRenderChunks(ROCK_FIELD.rocks,terrainHeight,material),legacy=legacyGeometry(THREE,ROCK_FIELD.rocks,terrainHeight),seen=new Set();
  assert.equal(group.name,'physical-rock-field');assert.equal(group.userData.rockCount,ROCK_FIELD.rocks.length);
  assert.ok(group.children.length>4&&group.children.length<=100);let triangles=0;
  for(const chunk of group.children) {
    assert.equal(chunk.material,material);assert.equal(chunk.frustumCulled,true);
    assert.deepEqual(chunk.position.toArray(),[0,0,0]);assert.deepEqual(chunk.scale.toArray(),[1,1,1]);
    assert.ok(chunk.geometry.boundingSphere.radius>0);assert.ok(Number.isFinite(chunk.geometry.boundingSphere.radius));
    const [cx,cz]=chunk.userData.cell.split(',').map(Number),positions=chunk.geometry.attributes.position;
    chunk.userData.rockIndices.forEach((rockIndex,localIndex)=>{
      assert.ok(!seen.has(rockIndex));seen.add(rockIndex);
      assert.equal(Math.floor(ROCK_FIELD.rocks[rockIndex].x/group.userData.chunkSize),cx);assert.equal(Math.floor(ROCK_FIELD.rocks[rockIndex].z/group.userData.chunkSize),cz);
      for(const name of ['position','color','normal']) {
        const local=chunk.geometry.attributes[name].array,reference=legacy.attributes[name].array;
        assert.deepEqual(local.slice(localIndex*75,(localIndex+1)*75),reference.slice(rockIndex*75,(rockIndex+1)*75),name+' matches unchunked stream');
      }
      const local=chunk.geometry.index.array.slice(localIndex*120,(localIndex+1)*120),reference=legacy.index.array.slice(rockIndex*120,(rockIndex+1)*120);
      assert.deepEqual(Array.from(local,v=>v-localIndex*25),Array.from(reference,v=>v-rockIndex*25),'same indexed topology and winding');
    });
    for(let i=0;i<positions.count;i++) {
      const p=new THREE.Vector3().fromBufferAttribute(positions,i);
      assert.ok(chunk.geometry.boundingBox.containsPoint(p));
      assert.ok(p.distanceTo(chunk.geometry.boundingSphere.center)<=chunk.geometry.boundingSphere.radius+1e-6,'sphere includes complete boundary-crossing rocks');
    }
    triangles+=chunk.geometry.index.count/3;chunk.geometry.dispose();
  }
  assert.equal(seen.size,ROCK_FIELD.rocks.length);assert.equal(triangles,legacy.index.count/3);
  assert.equal(JSON.stringify(ROCK_FIELD.rocks),original,'physics field is not mutated');legacy.dispose();material.dispose();
});

test('rock chunks permit true frustum rejection without distance-based disappearance',async()=>{
  const [THREE,{createRockRenderChunks}]=await modules;
  const rock=(x,z)=>({x,z,height:3,shade:.4,kind:'rock',vertices:Array.from({length:8},(_,i)=>({x:Math.cos(i*Math.PI/4)*2,z:Math.sin(i*Math.PI/4)*2}))});
  const material=new THREE.MeshBasicMaterial(),group=createRockRenderChunks([rock(0,-100),rock(0,100),rock(0,-4000)],()=>0,material);
  const camera=new THREE.PerspectiveCamera(65,1,.1,6000);camera.position.set(0,2,0);camera.lookAt(0,2,-100);camera.updateMatrixWorld();
  const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  const visible=group.children.filter(chunk=>frustum.intersectsObject(chunk)).flatMap(chunk=>chunk.userData.rockIndices);
  assert.deepEqual(visible,[0,2],'near and distant forward rocks remain; only behind-camera chunk is culled');
  assert.equal(group.children.length,3);for(const child of group.children)child.geometry.dispose();material.dispose();
});

test('new cliff renderer and physical support agree on actual visible triangles',async()=>{
  const [THREE,{createRockRenderChunks},{ROCK_FIELD,terrainHeight,rockSurfaceHeight,collides}]=await modules;
  const rocks=ROCK_FIELD.rocks.filter(r=>r.meshPositions),mat=new THREE.MeshStandardMaterial({side:THREE.DoubleSide});
  const group=createRockRenderChunks(rocks,terrainHeight,mat);group.updateMatrixWorld(true);
  assert.equal(rocks.length,7);
  const ray=new THREE.Raycaster();
  for(const r of rocks){
    assert(collides(r.x,r.z));
    for(const dx of [-2,0,2])for(const dz of [-2,0,2]){
      const x=r.x+dx,z=r.z+dz;ray.set(new THREE.Vector3(x,150,z),new THREE.Vector3(0,-1,0));
      const hits=ray.intersectObject(group,true);assert(hits.length>0);
      assert(Math.abs(hits[0].point.y-rockSurfaceHeight(r,x,z))<.001,'physical support matches rendered surface');
    }
  }
  for(const m of group.children)m.geometry.dispose();mat.dispose();
});

test('camera sweep stops above slope-planted cliff tops rather than the old centre-height proxy',async()=>{
  const [{ROCK_FIELD,rockSurfaceHeight},{cameraBlocked,sweepCamera}]=await Promise.all([import('../src/layout.mjs'),import('../src/camera.mjs')]);
  const r=ROCK_FIELD.rocks.find(r=>r.kind==='basalt-outcrop');
  const x=-68.384236,z=39.478261,top=rockSurfaceHeight(r,x,z);
  assert(top>25);assert(cameraBlocked({x,z,y:top-.25}));
  const sweep=sweepCamera({x,z,y:top+1},{x,z,y:top-.25});
  assert(sweep.occluded);assert(sweep.position.y>=top);
});
