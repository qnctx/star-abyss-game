const test=require('node:test');
const assert=require('node:assert/strict');

async function fixture(){
  const {createDashEffect}=await import('../src/dash-effect.mjs');
  const {terrainHeight}=await import('../src/layout.mjs');
  const player={x:0,y:terrainHeight(0,190),z:190,yaw:0};
  const state={active:true,serial:1,origin:{...player},dirX:0,dirZ:-1,remaining:.3,distance:4};
  return {fx:createDashEffect(),player,state,terrainHeight};
}
test('dash effect follows actual world displacement, ignores view yaw and freezes completely at dt zero',async()=>{
  const {fx,player,state,terrainHeight}=await fixture();
  fx.update(state,player,.016);player.z-=.5;player.y=terrainHeight(player.x,player.z);fx.update(state,player,.016);
  assert.equal(fx.snapshot().activeTrails,1);
  const before=fx.snapshot(),positions=fx.root.children[0].geometry.attributes.position.array.slice();
  player.yaw=2.2;player.x=400;fx.update(state,player,0);
  assert.deepEqual(fx.snapshot(),before);assert.deepEqual(fx.root.children[0].geometry.attributes.position.array,positions);
  assert.deepEqual(fx.root.position.toArray(),[0,0,0]);fx.dispose();
});
test('dash effect never connects teleports or different casts and dissipates within 400 ms',async()=>{
  const {fx,player,state,terrainHeight}=await fixture();
  fx.update(state,player,.016);player.z-=.5;fx.update(state,player,.016);assert.ok(fx.snapshot().activeTrails>0);
  player.x=1000;player.y=terrainHeight(player.x,player.z);fx.update(state,player,.016);
  assert.equal(fx.snapshot().activeTrails,0);assert.equal(fx.snapshot().maxSegmentLength,0);
  state.serial++;state.origin={...player};fx.update(state,player,.016);assert.equal(fx.snapshot().activeTrails,0);
  state.active=false;for(let i=0;i<8;i++)fx.update(state,player,.05);
  assert.equal(fx.snapshot().activeTrails,0);assert.equal(fx.snapshot().activeParticles,0);assert.equal(fx.root.visible,false);fx.dispose();
});
test('metal floors and airborne movement do not emit ground dust',async()=>{
  const {fx,player,state,terrainHeight}=await fixture();
  player.x=0;player.z=-600;player.y=terrainHeight(0,-600);state.origin={...player};fx.update(state,player,.016);
  player.z-=.5;fx.update(state,player,.016);assert.equal(fx.snapshot().lastSurface,'metal');assert.equal(fx.snapshot().activeParticles,0);
  state.serial++;player.z=190;player.y=terrainHeight(0,190)+2;state.origin={...player};fx.update(state,player,.016);
  player.z-=.5;fx.update(state,player,.016);assert.equal(fx.snapshot().activeParticles,0);fx.dispose();
});
test('200 dash cycles reuse fixed geometry and materials, keep depth occlusion and dispose ownership once',async()=>{
  const {fx,player,state,terrainHeight}=await fixture();
  const resources=new Set();fx.root.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material){resources.add(o.material);assert.equal(o.material.depthTest,true);assert.equal(o.material.depthWrite,false);}});
  const identities=fx.root.children.map(o=>[o.uuid,o.geometry.uuid,o.material.uuid]);let disposals=0;
  for(const resource of resources)resource.addEventListener('dispose',()=>disposals++);
  for(let cycle=0;cycle<200;cycle++){
    player.x=0;player.z=190;player.y=terrainHeight(0,190);state.origin={...player};state.serial++;state.active=true;
    for(let frame=0;frame<12;frame++){player.z-=.25;player.y=terrainHeight(player.x,player.z);fx.update(state,player,.016);}
    assert.ok(fx.snapshot().maxSegmentLength<1);assert.ok(fx.snapshot().activeTrails<=16);assert.ok(fx.snapshot().activeParticles<=24);
    state.active=false;for(let frame=0;frame<8;frame++)fx.update(state,player,.05);assert.equal(fx.root.visible,false);
  }
  assert.deepEqual(fx.root.children.map(o=>[o.uuid,o.geometry.uuid,o.material.uuid]),identities);
  assert.equal(resources.size,6);fx.dispose();fx.dispose();assert.equal(disposals,resources.size);assert.equal(fx.root.children.length,0);
});
