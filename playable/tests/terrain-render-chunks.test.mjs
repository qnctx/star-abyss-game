import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTerrainRenderChunks} from '../src/terrain-render-chunks.mjs';

function geometry(segments,size=6000){
  const result=new THREE.PlaneGeometry(size,size,segments,segments);result.rotateX(-Math.PI/2);
  const p=result.attributes.position,colors=new Uint8Array(p.count*3);
  for(let i=0;i<p.count;i++){p.setY(i,Math.sin(p.getX(i)*.0009)*14+Math.cos(p.getZ(i)*.001)*8);colors.set([i%256,(i*7)%256,(i*13)%256],i*3);}
  result.setAttribute('color',new THREE.BufferAttribute(colors,3,true));result.computeVertexNormals();return result;
}
function dispose(root,source,material){root.children.forEach(mesh=>mesh.geometry.dispose());source.dispose();material.dispose();}
test('chunks preserve every original triangle and all attributes, including normalized color and seam normals',()=>{
  const segments=7,source=geometry(segments),material=new THREE.MeshStandardMaterial(),root=createTerrainRenderChunks(THREE,source,material,segments,3);
  try{
    const seen=new Set();let triangleCount=0,areaBefore=0,areaAfter=0;
    const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
    const area=(g,index)=>{a.fromBufferAttribute(g.attributes.position,g.index.getX(index));b.fromBufferAttribute(g.attributes.position,g.index.getX(index+1));c.fromBufferAttribute(g.attributes.position,g.index.getX(index+2));return b.sub(a).cross(c.sub(a)).length()/2;};
    for(let i=0;i<source.index.count;i+=3)areaBefore+=area(source,i);
    for(const mesh of root.children){
      const {x,z,width,depth}=mesh.userData.terrainCells,g=mesh.geometry;
      assert.equal(mesh.material,material);assert.equal(mesh.receiveShadow,true);assert.equal(g.attributes.color.normalized,true);
      for(let v=0;v<=depth;v++)for(let u=0;u<=width;u++)for(const [name,original] of Object.entries(source.attributes)){
        const oldIndex=(z+v)*(segments+1)+x+u,index=v*(width+1)+u;
        for(let k=0;k<original.itemSize;k++)assert.equal(g.attributes[name].array[index*original.itemSize+k],original.array[oldIndex*original.itemSize+k],`${name} ${oldIndex}`);
      }
      let offset=0;
      for(let v=0;v<depth;v++)for(let u=0;u<width;u++){
        const cell=(z+v)*segments+x+u;assert.ok(!seen.has(cell));seen.add(cell);
        for(let k=0;k<6;k++){
          const index=g.index.getX(offset+k),global=(z+Math.floor(index/(width+1)))*(segments+1)+x+index%(width+1);
          assert.equal(global,source.index.getX(cell*6+k));
        }
        offset+=6;
      }
      for(let i=0;i<g.index.count;i+=3)areaAfter+=area(g,i);
      triangleCount+=g.index.count/3;
      assert.ok(g.boundingBox&&g.boundingSphere);
    }
    assert.equal(seen.size,segments**2);assert.equal(triangleCount,segments**2*2);
    assert.ok(Math.abs(areaBefore-areaAfter)/areaBefore<1e-12);
  }finally{dispose(root,source,material);}
});
test('full 6km terrain retains 720000 triangles but ground camera frustum submits fewer chunks',t=>{
  const source=geometry(600),material=new THREE.MeshStandardMaterial(),root=createTerrainRenderChunks(THREE,source,material);
  try{
    assert.equal(root.children.length,144);assert.equal(root.children.reduce((n,m)=>n+m.geometry.index.count/3,0),720000);
    assert.equal(root.children[0].geometry.attributes.position.count,51**2);
    const camera=new THREE.PerspectiveCamera(60,16/9,.1,1000);camera.position.set(0,80,0);camera.lookAt(0,0,-300);camera.updateMatrixWorld();root.updateMatrixWorld(true);
    const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    const visible=root.children.filter(m=>frustum.intersectsObject(m));
    assert.ok(visible.length>0&&visible.length<144);
    const triangles=visible.reduce((n,m)=>n+m.geometry.index.count/3,0);assert.ok(triangles<720000);
    t.diagnostic(`${visible.length}/144 chunks intersect the fixture camera frustum; ${triangles}/720000 triangles`);
  }finally{dispose(root,source,material);}
});
test('invalid or non-grid sources are rejected rather than silently changing the terrain',()=>{
  const material=new THREE.MeshBasicMaterial(),source=new THREE.PlaneGeometry(10,10,2,2);
  try{assert.throws(()=>createTerrainRenderChunks(THREE,source,material,3),TypeError);assert.throws(()=>createTerrainRenderChunks(THREE,source,material,2,0),TypeError);}
  finally{source.dispose();material.dispose();}
});
