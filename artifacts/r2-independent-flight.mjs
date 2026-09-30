import {createFlight,stepFlight} from '../playable/src/planet-gameplay/flight.mjs';
import {flightControls} from '../playable/src/planet-gameplay/index.mjs';
import {createRuntimeWorld} from '../playable/src/planet-gameplay/runtime-world.mjs';
import {createPlanetField} from '../playable/src/planet/field.mjs';
import {toCartesian,unit} from '../playable/src/planet/coordinates.mjs';

const field=createPlanetField();
const world=createRuntimeWorld({field,loaded:()=>true,solidSweep:()=>({ready:true,clear:true})});
const rows=[];
for(const [label,keys,yaw] of [
  ['W yaw0',{forward:true},0],['W yaw90',{forward:true},Math.PI/2],
  ['W yaw180',{forward:true},Math.PI],['W yaw270',{forward:true},-Math.PI/2],
]){
  const seed=toCartesian({lat:0,lon:0,height:0});
  const ground=field.sampleSurface(unit(seed)).height;
  const state=createFlight(toCartesian({lat:0,lon:0,height:ground+2000}));state.active=true;
  const start={...state.position},reasons={};
  const controls=flightControls(keys,yaw);
  for(let i=0;i<100;i++){
    const result=stepFlight(state,controls,.05,true,world);
    reasons[result.reason]=(reasons[result.reason]||0)+1;
  }
  rows.push({label,meters:Math.hypot(state.position.x-start.x,state.position.y-start.y,state.position.z-start.z),speed:state.speed,agl:world.sample(state.position).agl,reasons});
}
console.log(JSON.stringify(rows,null,2));
