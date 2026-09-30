import test from 'node:test';
import assert from 'node:assert/strict';
import {add,globalToLocal,localToGlobal,scale,tangentFrame,toGeodetic} from '../src/planet/coordinates.mjs';
import {flightAimInLocal,flightAimAtLocal} from '../src/planet/flight-aim.mjs';

const radius=120000,frame=tangentFrame(0,0,radius);
const angleError=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

test('basin centre preserves existing camera aim',()=>{
  const position=localToGlobal({x:0,y:30,z:0},frame);
  for(const [yaw,pitch] of [[0,0],[.8,-.45],[-1.7,.5]]){
    const aim=flightAimInLocal({position,yaw,pitch,frame,radius});
    assert.ok(Math.abs(angleError(aim.yaw,yaw))<1e-12);
    assert.ok(Math.abs(aim.pitch-pitch)<1e-12);
  }
});

test('outer basin projection and inverse keep a 40 m authority ray on the visual target',()=>{
  for(const local of [{x:2780,y:35,z:2140},{x:-2680,y:1850,z:-2200},{x:2400,y:250,z:-2650}]){
    const position=localToGlobal(local,frame),geo=toGeodetic(position,radius),basis=tangentFrame(geo.lat,geo.lon,radius);
    for(const [yaw,pitch] of [[.67,-.42],[-1.16,.23],[2.4,-.68]]){
      const projected=flightAimInLocal({position,yaw,pitch,frame,radius});
      const source=globalToLocal(add(position,scale(basis.up,1)),frame);
      const target={x:source.x+projected.direction.x*40,y:source.y+projected.direction.y*40,z:source.z+projected.direction.z*40};
      const inverse=flightAimAtLocal({position,target,frame,radius});
      assert.ok(Math.abs(angleError(inverse.yaw,yaw))<1e-10,`yaw at ${JSON.stringify(local)}`);
      assert.ok(Math.abs(inverse.pitch-pitch)<1e-10,`pitch at ${JSON.stringify(local)}`);
      assert.ok(Math.hypot(inverse.origin.x-source.x,inverse.origin.y-source.y,inverse.origin.z-source.z)<1e-8);
    }
  }
});

test('edge of chart needs true tangent conversion and rejects a zero-distance aim',()=>{
  const position=localToGlobal({x:2800,y:200,z:2500},frame),projected=flightAimInLocal({position,yaw:.7,pitch:-.4,frame,radius});
  assert.ok(Math.abs(projected.pitch-(-.4))>.005);
  assert.throws(()=>flightAimAtLocal({position,target:globalToLocal(add(position,scale(tangentFrame(toGeodetic(position,radius).lat,toGeodetic(position,radius).lon,radius).up,1)),frame),frame,radius}));
});
