import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlanetField} from '../src/planet/field.mjs';
import {toCartesian,unit,length,sub} from '../src/planet/coordinates.mjs';
import {createPlanetMap,projectPlanet,unprojectPlanet,sphericalNavigation} from '../src/planet-map.mjs';
const field=createPlanetField(),R=field.planet.radius,origin=toCartesian({lat:0,lon:0},R),near=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
test('global projection roundtrips both hemispheres, dateline and poles',()=>{
 for(const lat of [-Math.PI/2,-1,0,.8,Math.PI/2])for(const lon of [-Math.PI,-2,0,2,Math.PI]){const p=toCartesian({lat,lon},R),xy=projectPlanet(p,{radius:R}),q=unprojectPlanet(xy,{radius:R});near(length(sub(unit(p),q)),0);}
 assert.notEqual(projectPlanet(origin,{radius:R}).x,projectPlanet({x:-R,y:0,z:0},{radius:R}).x);
 assert.throws(()=>unprojectPlanet({x:-1,y:1},{radius:R}));
});
test('great circle distances and initial north/east bearings use spherical coordinates',()=>{
 const east=toCartesian({lat:0,lon:Math.PI/2},R),north=toCartesian({lat:Math.PI/4,lon:0},R);
 near(sphericalNavigation(origin,east,R).distance,Math.PI*R/2);near(sphericalNavigation(origin,east,R).bearing,90);near(sphericalNavigation(origin,north,R).bearing,0);
 assert.equal(sphericalNavigation(origin,origin,R).bearing,null);assert.equal(sphericalNavigation(origin,{x:-R,y:0,z:0},R).bearing,null);
 assert.equal(sphericalNavigation({x:0,y:R,z:0},origin,R).bearing,null);
 near(sphericalNavigation(toCartesian({lat:0,lon:179*Math.PI/180},R),toCartesian({lat:0,lon:-179*Math.PI/180},R),R).distance,R*2*Math.PI/180);
});
test('base map samples the same field once; four real surveys, camp and parked vehicle',()=>{
 let calls=0;const counted={...field,sample:p=>{calls++;return field.sample(p);}},map=createPlanetMap({field:counted,columns:24,rows:12});assert.equal(calls,288);
 const state={position:origin,vehicle:{position:toCartesian({lat:.5,lon:2,height:30},R)},progression:{surveys:['plains','forest']}},result=map.render(state);map.render({...state,position:{x:-R,y:0,z:0}});assert.equal(calls,288);
 assert.equal(result.model.markers.length,7);assert.equal(result.model.markers.filter(m=>m.kind==='survey').length,4);assert.equal(result.model.markers.find(m=>m.id==='survey:forest').completed,true);assert.equal(result.model.markers.find(m=>m.id==='survey:coast').completed,false);
 assert.ok(result.svg.includes('viewBox="0 0 960 480"'));assert.ok(result.svg.includes('data-target="vehicle"'));assert.ok(result.model.legend.every(m=>Number.isFinite(m.distance)));
 for(const a of result.model.markers)for(const b of result.model.markers)if(a!==b)assert.ok(Math.hypot(a.displayX-b.displayX,a.displayY-b.displayY)>=20);
});
test('selection returns exact canonical target without changing state, no teleport',()=>{
 const map=createPlanetMap({field,columns:8,rows:4}),state={position:origin,vehicle:{position:toCartesian({lat:.5,lon:2,height:500},R)},progression:{surveys:[]}},before=JSON.stringify(state);
 const chosen=map.select('vehicle',state);assert.deepEqual(chosen.position,state.vehicle.position);near(chosen.height,500);assert.equal(map.select('missing',state),null);assert.equal(map.select('player',state),null);
 const survey=map.select('survey:forest',state);assert.deepEqual(survey.position,field.routeLandmarks.find(m=>m.id==='forest').position);
 const point=map.pick({x:150,y:80},state,{hitRadius:0});assert.equal(point.id,'point');near(length(point.position)-R,field.sample(point.position).height);assert.equal(JSON.stringify(state),before);
});
test('backside parked marker and dateline picking cannot alias the original basin XZ',()=>{
 const map=createPlanetMap({field,columns:8,rows:4}),state={position:origin,vehicle:{position:{x:-R,y:0,z:0}}},model=map.model(state),car=model.markers.find(m=>m.id==='vehicle');
 near(car.x,0);near(car.distance,Math.PI*R);assert.equal(map.pick({x:960,y:240},state).id,'vehicle');assert.equal(map.pick({x:0,y:240},state).id,'vehicle');
 assert.equal(map.model({...state,vehicle:{...state.vehicle,parked:false}}).markers.some(m=>m.id==='vehicle'),false);
});
test('invalid inputs cannot create silent fake survey or oldXZ parking locations',()=>{
 assert.throws(()=>createPlanetMap({field:{...field,routeLandmarks:[]}}));assert.throws(()=>createPlanetMap({field,columns:10000,rows:10000}));
 const map=createPlanetMap({field,columns:8,rows:4});assert.throws(()=>map.render({position:{x:0,z:190}}));assert.throws(()=>map.model({position:origin,vehicle:{position:{x:20,z:30}}}));
});
