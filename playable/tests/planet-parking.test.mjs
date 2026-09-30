import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlanetParking,isLegacyPose} from '../src/planet-parking.mjs';
import {restorePlayer} from '../src/movement.mjs';
const base=()=>({version:1,player:{x:0,y:0,z:190,heading:0,yaw:0,pitch:0},mobility:{vehicle:{x:9,z:196,battery:80,mounted:false}},story:{flags:{complete:true}},expedition:{worldId:'original:existing',rescueRevision:2}});
test('planet excursion preserves a restorable legacy pose and current story/link without aliasing',()=>{
 const original=base(),parking=createPlanetParking(original),distant={...base(),player:{x:45000,y:240000,z:6000,yaw:1,pitch:-.7},planet:{position:{x:360000,y:40000,z:12000}}};
 distant.story.flags.returned=true;
 const saved=parking.snapshot(distant,false);
 assert.deepEqual(saved.player,original.player);assert.deepEqual(saved.planet,distant.planet);
 assert.equal(saved.story.flags.returned,true);assert.equal(saved.expedition.worldId,'original:existing');
 const restored=restorePlayer(saved.player,true);assert.equal(restored.x,0);assert.equal(restored.z,190);
 saved.player.x=500;assert.equal(parking.pose().x,0);
});
test('only validated basin poses advance parking and rescue replaces the old checkpoint',()=>{
 const parking=createPlanetParking(base());
 assert.equal(parking.observe({...base(),player:{...base().player,x:3001}},true),false);
 assert.equal(isLegacyPose(base().player,true),false);
 const later={...base(),player:{...base().player,x:180}};
 assert.equal(parking.observe(later,true),true);assert.equal(parking.pose().x,180);
 parking.rescue(base().player,base().mobility);assert.equal(parking.pose().x,0);
 assert.throws(()=>parking.rescue({...base().player,x:6000},base().mobility));
});
