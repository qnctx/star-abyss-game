const test = require('node:test');
const assert = require('node:assert/strict');
const shapes = import('../src/avatar-shapes.mjs');

const outline=[[-.15,.5,.08],[-.07,.54,.12],[.02,.48,.14],[.015,.25,.13],[-.06,.18,.12],[-.12,.32,.10]];
function geometryHealth(geometry) {
  for(const name of ['position','normal','uv']) {
    assert.ok(geometry.getAttribute(name));
    assert.ok([...geometry.getAttribute(name).array].every(Number.isFinite),name+' must be finite');
  }
  geometry.computeBoundingBox();
  assert.ok(!geometry.boundingBox.isEmpty());
}
function closedEdges(geometry) {
  const positions=geometry.attributes.position,edges=new Map(), winding=new Map();
  const key=index=>[positions.getX(index),positions.getY(index),positions.getZ(index)].map(v=>Math.round(v*1e5)).join(',');
  for(let i=0;i<geometry.index.count;i+=3){
    const ids=[0,1,2].map(j=>key(geometry.index.getX(i+j)));
    assert.equal(new Set(ids).size,3,'non-degenerate triangles');
    for(let j=0;j<3;j++) {
      const edge=[ids[j],ids[(j+1)%3]].sort().join('/');
      edges.set(edge,(edges.get(edge)||0)+1);
      winding.set(edge,(winding.get(edge)||0)+(ids[j]<ids[(j+1)%3]?1:-1));
    }
  }
  assert.ok([...edges.values()].every(count=>count===2),'each physical edge must have two faces');
  assert.ok([...winding.values()].every(count=>count===0),'adjacent face normals must agree');
}
test('C2 mineral panels are closed on front, back and curved edges',async()=>{
  const { mineralPlateGeometry } = await shapes;
  for(const points of [outline,[...outline].reverse()]) {
    const geometry=mineralPlateGeometry(points,.007,.006);
    geometryHealth(geometry);closedEdges(geometry);
    assert.ok(geometry.index.count/3<10000,'small panel triangle budget');
    geometry.dispose();
  }
});
test('tailored limbs and rounded boot uppers have finite geometry and closed soles',async()=>{
  const { tailoredGeometry, bootGeometry } = await shapes;
  const cloth=tailoredGeometry([[-.3,.045,.05],[-.16,.064,.06],[0,.05,.047]],{folds:.003});
  geometryHealth(cloth);closedEdges(cloth);cloth.dispose();
  for(const sole of [false,true]){const boot=bootGeometry(sole);geometryHealth(boot);closedEdges(boot);boot.dispose();}
});
