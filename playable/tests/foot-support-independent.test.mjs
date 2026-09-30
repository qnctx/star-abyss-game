import test from 'node:test';
import assert from 'node:assert/strict';
import {ROCK_FIELD,rockSurfaceHeight,supportHeight,terrainHeight,collidesAtHeight} from '../src/layout.mjs';
import {createPlayer} from '../src/movement.mjs';
import {createMobility,stepMobility} from '../src/mobility.mjs';

function emptyEdge(rock) {
  for(let direction=0;direction<32;direction++){
    const angle=direction*Math.PI/16,ux=Math.cos(angle),uz=Math.sin(angle);
    let lo=0,hi=rock.radius*2;
    for(let i=0;i<24;i++){const mid=(lo+hi)/2;Number.isFinite(rockSurfaceHeight(rock,rock.x+ux*mid,rock.z+uz*mid))?lo=mid:hi=mid;}
    const x=rock.x+ux*(hi+.08),z=rock.z+uz*(hi+.08),ground=terrainHeight(x,z);
    const beside=rockSurfaceHeight(rock,x-ux*.35,z-uz*.35);
    if(beside>ground+.45&&supportHeight(x,z)===ground)return {x,z,ground,beside};
  }
  throw Error('No isolated high edge in chosen real geometry');
}
const ordinary=ROCK_FIELD.rocks.find(r=>r.solid&&r.x===24&&r.z===130);
test('visible ordinary rock edge does not become radius-inflated invisible support',()=>{
  const p=emptyEdge(ordinary);assert.equal(rockSurfaceHeight(ordinary,p.x,p.z),-Infinity);
  for(const radius of [0,.1,.42,.8])assert.equal(supportHeight(p.x,p.z,radius),p.ground);
  assert.equal(collidesAtHeight(p.x,p.z,p.ground),true,'capsule side still collides with adjacent solid');
});
test('standing at an empty edge enters gravity and falls instead of hanging from nearby rock',()=>{
  const edge=emptyEdge(ordinary),p={...createPlayer(),x:edge.x,z:edge.z,y:edge.beside+.05},state=createMobility();
  const start=p.y;stepMobility(p,state,{},1/60);assert.equal(state.jump.airborne,true);
  for(let i=0;i<12;i++)stepMobility(p,state,{},1/60);
  assert.ok(p.y<start-.2);assert.equal(state.flight.airborne,false);
  for(let i=0;i<120;i++)stepMobility(p,state,{},1/60);
  assert.equal(p.y,terrainHeight(p.x,p.z));assert.equal(state.jump.airborne,false);
});
test('falling below a nearby rock top is never snapped upward to that top',()=>{
  const p={...createPlayer(),x:ordinary.x,z:ordinary.z},state=createMobility();
  const top=rockSurfaceHeight(ordinary,p.x,p.z);p.y=top-.25;state.jump.airborne=true;state.jump.vy=-1;
  const before=p.y;stepMobility(p,state,{},1/60);assert.ok(p.y<before);assert.ok(p.y<top);
});
test('descending from above still lands exactly on the visible rock top',()=>{
  const p={...createPlayer(),x:ordinary.x,z:ordinary.z},state=createMobility();const top=rockSurfaceHeight(ordinary,p.x,p.z);
  p.y=top+2;state.jump.airborne=true;state.jump.vy=0;
  for(let i=0;i<120;i++)stepMobility(p,state,{},1/60);
  assert.equal(p.y,top);assert.equal(state.jump.airborne,false);
});
test('ordinary forward walking can leave the actual rock top without capsule-side pinning',()=>{
  const edge=emptyEdge(ordinary),dx=edge.x-ordinary.x,dz=edge.z-ordinary.z;
  const p={...createPlayer(),x:ordinary.x,z:ordinary.z,y:rockSurfaceHeight(ordinary,ordinary.x,ordinary.z),yaw:Math.atan2(-dx,-dz)},state=createMobility();
  let fell=false;
  for(let i=0;i<240;i++){stepMobility(p,state,{forward:true},1/60);fell ||= state.jump.airborne;}
  assert.ok(fell,'must enter gravity while stepping down from actual slope');
  assert.ok(Math.hypot(p.x-ordinary.x,p.z-ordinary.z)>ordinary.radius+.5,'must leave rock rather than pin against its own side');
  assert.equal(p.y,terrainHeight(p.x,p.z));
});
test('real cliff triangle edge is unsupported despite adjacent capsule contact',()=>{
  let edge;
  for(const rock of ROCK_FIELD.rocks.filter(r=>r.solid&&r.meshPositions)){
    try{edge=emptyEdge(rock);break;}catch{}
  }
  assert.ok(edge,'at least one real cliff has a high outer edge');assert.equal(supportHeight(edge.x,edge.z,.42),edge.ground);
});
