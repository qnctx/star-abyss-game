import { WORLD, WALLS, PROP_SOLIDS, GATE, ROCK_FIELD, collides, collidesAtHeight, supportHeight, terrainHeight, insideWreck, surfaceAt, worldBoundaryBlocked } from './layout.mjs';
import {physicalPropBlocked,physicalPropSupport} from './foundation/physical-props.mjs';
import { touchesRock } from './rocks.mjs';
import { movePlayer, movementHeading, hasLineOfSight } from './movement.mjs';
import { ENDURANCE, enduranceDrain } from './endurance.mjs';
import {postureBlocked} from './tactical-control.mjs';
import {sampleTerrainContact,advanceVerticalContact} from './terrain-contact.mjs';

export const MOBILITY=Object.freeze({maxEnergy:ENDURANCE.capacity,maxAltitude:WORLD.suitAltitude,launchEnergy:25,flightSpeed:12,flightDrain:enduranceDrain(),recoveryDelay:2,recoveryRate:12,vehicleSpeed:24,vehicleBoost:32,vehicleRadius:1.1,vehicleBodyHeight:1.3,vehicleCapacity:100,vehicleConsumption:.01,vehicleBoostConsumption:.014,parkedCharge:.8,beaconCharge:5,vehicleSpawn:{x:72,z:80},partPosition:{x:98,z:62}});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;
const flightDrain=rules=>enduranceDrain(rules?.flightDrain);
export function createMobility() {
  return {jump:{airborne:false,held:false,vy:0,time:0,landing:0},flight:{energy:MOBILITY.maxEnergy,airborne:false,thrusting:false,liftHeld:false,recoveryRemaining:0,vy:0,exhausted:false},vehicle:{...MOBILITY.vehicleSpawn,yaw:0,battery:MOBILITY.vehicleCapacity,repaired:false,coupler:false,partTaken:false,mounted:false}};
}
export function mobilityPoints(state) {
  return [{id:'skimmer',name:state.vehicle.repaired?'巡迹勘探车':'巡迹勘探车残骸',x:state.vehicle.x,z:state.vehicle.z,type:'transport'},...(!state.vehicle.partTaken?[{id:'skimmer-part',name:'动力耦合芯回收匣',...MOBILITY.partPosition,type:'pickup'}]:[])];
}
export function clearMobilityInput(state) {
  state.flight.liftHeld=false;state.flight.thrusting=false;
  if(state.jump)state.jump.held=false;
}
function vehicleBlocked(x,z,gateOpen) {
  const radius=MOBILITY.vehicleRadius;
  if(physicalPropBlocked(x,z,terrainHeight(x,z),radius,1.8))return true;
  if(worldBoundaryBlocked(x,z,radius))return true;
  if(Math.abs(x)<50+radius&&z<-469+radius&&z>-793-radius)return true;
  if([...WALLS,...PROP_SOLIDS,...(gateOpen?[]:[GATE])].some(b=>Math.abs(x-b.x)<b.w/2+radius&&Math.abs(z-b.z)<b.d/2+radius))return true;
  return ROCK_FIELD.query(x,z,radius).some(r=>r.solid&&touchesRock(r,x,z,radius));
}
function parkedVehicleBlocked(x,z,state,feet) {
  const v=state.vehicle;if(v.mounted||Math.hypot(x-v.x,z-v.z)>=1.35)return false;
  if(feet<=terrainHeight(x,z)+.05)return true;
  let top=parkedVehicleSurfaceHeight(x,z,v);
  for(let i=0;i<8;i++)top=Math.max(top,parkedVehicleSurfaceHeight(x+Math.cos(i*Math.PI/4)*WORLD.radius,z+Math.sin(i*Math.PI/4)*WORLD.radius,v));
  return top>feet+WORLD.radius+.035;
}
export function groundMobilityBlocked(x,z,state,gateOpen=false) {
  return collides(x,z,gateOpen)||parkedVehicleBlocked(x,z,state,terrainHeight(x,z));
}
// Analytic vertical rays against the visible body ellipsoids in vehicle-model.
// Yaw, terrain tilt, repaired hover and wreck roll match the render transforms.
export function parkedVehicleSurfaceHeight(x,z,v) {
  if(Math.hypot(x-v.x,z-v.z)>1.5)return -Infinity;
  const up=v.surfaceNormal||{x:0,y:1,z:0},n=Math.hypot(up.x,up.y,up.z),u=[up.x/n,up.y/n,up.z/n],f=[-Math.sin(v.yaw||0),0,-Math.cos(v.yaw||0)];
  const dot=f.reduce((sum,a,i)=>sum+a*u[i],0);for(let i=0;i<3;i++)f[i]-=dot*u[i];const fn=Math.hypot(...f);for(let i=0;i<3;i++)f[i]/=fn;
  const r=[f[1]*u[2]-f[2]*u[1],f[2]*u[0]-f[0]*u[2],f[0]*u[1]-f[1]*u[0]];
  const dx=x-v.x,dz=z-v.z,o=[dx*r[0]+dz*r[2],dx*u[0]+dz*u[2]-(v.repaired?.16:0),-dx*f[0]-dz*f[2]],d=[r[1],u[1],-f[1]];
  const angle=v.repaired?0:.10,c=Math.cos(angle),s=Math.sin(angle);
  for(const p of [o,d]){const px=p[0];p[0]=c*px-s*p[1];p[1]=s*px+c*p[1];}
  const pieces=[[0,.54,0,.29,.18,.87],[0,.66,-.53,.28,.18,.50],[0,.81,.20,.20,.085,.40],[0,.93,.13,.16,.045,.31],[0,.61,.68,.24,.17,.27]];
  for(const side of [-1,1])pieces.push([side*.62,.34,-.03,.235,.16,.69],[side*.62,.43,-.07,.21,.10,.63]);
  let top=-Infinity;
  for(const p of pieces){let a=0,b=0,cc=-1;for(let i=0;i<3;i++){const q=(o[i]-p[i])/p[i+3],v=d[i]/p[i+3];a+=v*v;b+=2*q*v;cc+=q*q;}const discriminant=b*b-4*a*cc;if(discriminant>=0)top=Math.max(top,(-b+Math.sqrt(discriminant))/(2*a));}
  return top+(v.y??terrainHeight(v.x,v.z));
}
function mobilitySupportHeight(x,z,state,maxHeight=Infinity) {
  const floor=supportHeight(x,z,0,maxHeight),v=state.vehicle,top=parkedVehicleSurfaceHeight(x,z,v);
  return !v.mounted&&top<=maxHeight?Math.max(floor,top):floor;
}
function landingSpot(player,state,gateOpen) {
  const clear=(x,z)=>!groundMobilityBlocked(x,z,state,gateOpen);
  if(clear(player.x,player.z))return {x:player.x,z:player.z};
  for(let radius=.6;radius<=8;radius+=.6)for(let i=0;i<16;i++) {
    const x=player.x+Math.cos(i*Math.PI/8)*radius,z=player.z+Math.sin(i*Math.PI/8)*radius;
    if(clear(x,z)&&!insideWreck(x,z)&&hasLineOfSight(player,{x,z},gateOpen))return {x,z};
  }
  return {...WORLD.spawn};
}
export function restoreMobility(raw,player,gateOpen=false) {
  const state=createMobility(),f=state.flight,v=state.vehicle,saved=raw?.vehicle;
  f.energy=clamp(finite(raw?.flight?.energy,MOBILITY.maxEnergy),0,MOBILITY.maxEnergy);
  f.recoveryRemaining=clamp(finite(raw?.flight?.recoveryRemaining,0),0,MOBILITY.recoveryDelay);
  if(saved) {
    v.repaired=saved.repaired===true;v.partTaken=saved.partTaken===true||saved.coupler===true||v.repaired;v.coupler=v.partTaken&&!v.repaired;
    v.battery=clamp(finite(saved.battery,MOBILITY.vehicleCapacity),0,MOBILITY.vehicleCapacity);v.yaw=finite(saved.yaw,0)%(Math.PI*2);
    if(Number.isFinite(saved.x)&&Number.isFinite(saved.z)&&!vehicleBlocked(saved.x,saved.z,gateOpen)){v.x=saved.x;v.z=saved.z;}
    const contact=sampleTerrainContact({height:terrainHeight,x:v.x,z:v.z,yaw:v.yaw});
    v.surfaceNormal=contact.normal;v.y=contact.height;v.vy=0;v.grounded=true;
    if(saved.grounded===false&&Number.isFinite(saved.y)&&saved.y>contact.height&&saved.y<contact.height+500){v.y=saved.y;v.vy=clamp(finite(saved.vy,0),-120,0);v.grounded=false;}
    if(saved.mounted===true&&v.repaired){v.mounted=true;player.x=v.x;player.z=v.z;player.vx=0;player.vz=0;}
  }
  // Resume an airborne save in a controlled descent, never with a held thruster.
  const ground=terrainHeight(player.x,player.z);
  if(!v.mounted&&Number.isFinite(player.y)&&player.y>ground+.05&&!collidesAtHeight(player.x,player.z,player.y,gateOpen)&&!parkedVehicleBlocked(player.x,player.z,state,player.y)) {
    f.airborne=true;f.vy=-1;f.recoveryRemaining=MOBILITY.recoveryDelay;
  } else if(!v.mounted&&(collides(player.x,player.z,gateOpen)||parkedVehicleBlocked(player.x,player.z,state,finite(player.y,ground)))) {
    Object.assign(player,landingSpot(player,state,gateOpen),{vx:0,vz:0});player.y=terrainHeight(player.x,player.z);
  } else player.y=v.mounted?(v.y??ground):ground;
  return state;
}
export function serializeMobility(state) {
  return {flight:{energy:state.flight.energy,recoveryRemaining:state.flight.recoveryRemaining},vehicle:{...state.vehicle}};
}
export function mobilityAction(player,state,id,gateOpen=false) {
  const v=state.vehicle,f=state.flight;
  if(state.jump?.airborne)return {changed:false,message:'先落地，再操作。'};
  if(id==='skimmer-part') {
    if(f.airborne||v.mounted)return {changed:false,message:'先落地或下车，再打开回收匣。'};
    if(v.partTaken)return {changed:false,message:'耦合芯已经回收。'};
    if(Math.hypot(player.x-MOBILITY.partPosition.x,player.z-MOBILITY.partPosition.z)>3.2)return {changed:false,message:'靠近回收匣后再取出耦合芯。'};
    v.partTaken=true;v.coupler=true;return {changed:true,message:'回收动力耦合芯。返回勘探车，按 F 接回动力回路。'};
  }
  if(id==='dismount'&&v.mounted) {
    if(v.grounded===false)return {changed:false,message:'车辆正在下落，请落地停稳后再下车。'};
    if(Math.hypot(player.vx,player.vz)>2)return {changed:false,message:'先松开方向键或按住 Space 刹车，停稳后再下车。'};
    for(const angle of [Math.PI/2,-Math.PI/2,Math.PI,0]) {
      const x=v.x+Math.sin(v.yaw+angle)*2.5,z=v.z+Math.cos(v.yaw+angle)*2.5;
      if(collides(x,z,gateOpen)||insideWreck(x,z))continue;
      // Do not let an exit offset jump through a narrow wall or rock.
      let clear=true;for(let i=1;i<=10;i++)if(collides(v.x+(x-v.x)*i/10,v.z+(z-v.z)*i/10,gateOpen)){clear=false;break;}
      if(!clear)continue;
      // Leave the seat facing the vehicle's physical heading, not the orbit camera
      // or a stale walking heading from before boarding. Looking stays independent.
      v.mounted=false;v.driveSpeed=0;v.slipVX=0;v.slipVZ=0;Object.assign(player,{x,z,y:terrainHeight(x,z),heading:v.yaw,vx:0,vz:0});clearMobilityInput(state);
      return {changed:true,message:'已下车。勘探车停在原地，地图保留位置；停泊时太阳能补充电池。'};
    }
    return {changed:false,message:'两侧没有安全下车空间。稍微驶离碎石或墙壁再停下。'};
  }
  if(id!=='skimmer')return {changed:false,message:''};
  if(Math.hypot(player.x-v.x,player.z-v.z)>3.2)return {changed:false,message:'靠近勘探车后再操作。'};
  if(f.airborne)return {changed:false,message:'先落地，再检修或上车。'};
  if(!v.repaired) {
    if(!v.coupler)return {changed:false,message:'动力耦合芯缺失。车身东侧约 32 米处有回收匣，取回零件后可修复。'};
    v.coupler=false;v.repaired=true;return {changed:true,message:'动力回路接通。按 F 上车；W/S 油门 · A/D 转向 · 鼠标环视，Shift 加速，Space 刹车。'};
  }
  if(v.mounted)return mobilityAction(player,state,'dismount',gateOpen);
  v.mounted=true;v.driveSpeed=0;v.slipVX=0;v.slipVZ=0;Object.assign(player,{x:v.x,z:v.z,y:v.y??terrainHeight(v.x,v.z),vx:0,vz:0});clearMobilityInput(state);
  return {changed:true,message:'已上车。靠近坠毁飞船时停车步行进入；F 停稳下车。'};
}
export function stepMobility(player,state,controls,delta,gateOpen=false,rules={}) {
  const dt=clamp(finite(delta,0),0,.05),f=state.flight,v=state.vehicle;
  if(dt<=0)return {distance:0,moving:false,sprinting:false,blocked:false,surface:surfaceAt(player.x,player.z)};
  const ground=terrainHeight(player.x,player.z);player.y=finite(player.y,ground);
  const j=state.jump||(state.jump={airborne:false,held:false,vy:0,time:0,landing:0});
  const jumpPressed=!!controls.jump&&!j.held;j.held=!!controls.jump;j.landing=Math.max(0,j.landing-dt);
  if(v.mounted) {
    j.airborne=false;player.posture='stand';
    f.airborne=false;f.thrusting=false;f.liftHeld=!!controls.lift;
    const brake=!!controls.lift,boost=!!(controls.boost??controls.sprint),speed=v.battery>0?(boost?MOBILITY.vehicleBoost:MOBILITY.vehicleSpeed):0;
    // Vehicle heading is a physical state, never the free-look camera yaw.
    const signedSpeed=Number.isFinite(v.driveSpeed)?v.driveSpeed:-(player.vx||0)*Math.sin(v.yaw)-(player.vz||0)*Math.cos(v.yaw);
    const throttle=Number(!!controls.forward)-Number(!!controls.backward);
    const target=brake?0:throttle*(throttle<0?Math.min(speed,10):speed);
    const rate=brake?28:throttle&&Math.sign(throttle)!==Math.sign(signedSpeed)&&Math.abs(signedSpeed)>.2?18:throttle?9:5;
    const nextSpeed=signedSpeed+clamp(target-signedSpeed,-rate*dt,rate*dt);
    const steering=Number(!!controls.left)-Number(!!controls.right);
    const nextYaw=v.yaw+steering*Math.tan(.48)*nextSpeed/6*dt;
    const startX=player.x,startZ=player.z;
    let contact=sampleTerrainContact({height:terrainHeight,x:player.x,z:player.z,yaw:nextYaw});
    if(!contact.ready)return {distance:0,moving:false,sprinting:false,blocked:true,surface:'vehicle'};
    if(!Number.isFinite(v.y)){v.y=contact.height;v.vy=0;v.grounded=true;}
    if(v.grounded!==false&&v.y<contact.height-.02)v.y=contact.height;
    let dx=-Math.sin(nextYaw)*nextSpeed*dt,dz=-Math.cos(nextYaw)*nextSpeed*dt;
    // On grades too steep for traction gravity carries the craft downhill even
    // without throttle. A released control cannot suspend it against a cliff.
    const slide=contact.slope>.85&&v.grounded!==false?Math.min(6,(contact.slope-.85)*5):0;
    const slidingX=slide?-contact.gradient.x/contact.slope*slide:0,slidingZ=slide?-contact.gradient.z/contact.slope*slide:0,slideBlend=1-Math.exp(-dt*(slide?3:12));
    v.slipVX=(v.slipVX||0)+(slidingX-(v.slipVX||0))*slideBlend;v.slipVZ=(v.slipVZ||0)+(slidingZ-(v.slipVZ||0))*slideBlend;
    dx+=v.slipVX*dt;dz+=v.slipVZ*dt;
    let blocked=false;
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.2));
    for(let i=0;i<steps;i++) {
      const x=player.x+dx/steps,z=player.z+dz/steps;
      if(vehicleBlocked(x,z,gateOpen)){blocked=true;break;}
      const next=sampleTerrainContact({height:terrainHeight,x,z,yaw:nextYaw});
      const distance=Math.hypot(x-player.x,z-player.z),rise=next.height-contact.height;
      if(!next.ready||rise>distance*.85+.012||(v.grounded===false&&next.height>v.y+.08)){blocked=true;break;}
      player.x=x;player.z=z;contact=next;
    }
    v.yaw=nextYaw;
    v.driveSpeed=blocked?0:nextSpeed;if(blocked){v.slipVX=0;v.slipVZ=0;}
    player.vx=blocked?0:dx/dt;player.vz=blocked?0:dz/dt;
    const distance=Math.hypot(player.x-startX,player.z-startZ);
    const motion={distance,moving:distance>.0005,blocked};
    const vertical=advanceVerticalContact({y:v.y,vy:v.vy??0,grounded:v.grounded!==false},contact.height,dt,{snapDistance:Math.max(.25,distance*.85+.025)});
    Object.assign(v,vertical,{surfaceNormal:contact.normal});player.y=v.y;v.x=player.x;v.z=player.z;
    v.battery=clamp(v.battery-motion.distance*(boost?MOBILITY.vehicleBoostConsumption:MOBILITY.vehicleConsumption),0,MOBILITY.vehicleCapacity);
    return {...motion,sprinting:false,surface:'vehicle'};
  }
  v.battery=clamp(v.battery+dt*(Math.hypot(v.x,v.z-196)<14?MOBILITY.beaconCharge:MOBILITY.parkedCharge),0,MOBILITY.vehicleCapacity);
  const held=!!controls.lift,pressed=held&&!f.liftHeld;f.liftHeld=held;
  if(!f.airborne&&pressed&&f.energy>=MOBILITY.launchEnergy&&!insideWreck(player.x,player.z)&&(player.posture||'stand')==='stand') {f.airborne=true;f.vy=3.4;f.exhausted=false;j.airborne=false;}
  if(!f.airborne&&!j.airborne&&jumpPressed&&j.landing===0&&(player.posture||'stand')==='stand'){
    j.airborne=true;j.vy=4.9;j.time=0;
  }
  if(j.airborne&&!f.airborne){
    const previousY=player.y;
    j.time+=dt;const nextY=player.y+j.vy*dt-7*dt*dt;j.vy-=14*dt;
    if(j.vy>0&&collidesAtHeight(player.x,player.z,nextY,gateOpen)){j.vy=0;}
    else player.y=nextY;
    // Preserve takeoff momentum, with bounded air steering and no thruster energy.
    const motion=movePlayer(player,{...controls,sprint:false},dt,gateOpen,{acceleration:2.5,collides:(x,z)=>collidesAtHeight(x,z,player.y,gateOpen)||parkedVehicleBlocked(x,z,state,player.y)});
    const floor=mobilitySupportHeight(player.x,player.z,state,previousY+.035);
    if(player.y<=floor+.015&&j.vy<=0){player.y=floor;j.airborne=false;j.vy=0;j.landing=.18;}
    return {...motion,sprinting:false,surface:j.airborne?'air':surfaceAt(player.x,player.z)};
  }
  if(f.airborne) {
    f.thrusting=held&&f.energy>0&&!f.exhausted&&!insideWreck(player.x,player.z);
    f.recoveryRemaining=MOBILITY.recoveryDelay;
    // Equipment evolution changes consumption only; altitude and relaunch rules stay physical.
    if(f.thrusting) {f.energy=Math.max(0,f.energy-flightDrain(rules)*dt);if(f.energy<1e-8){f.energy=0;f.thrusting=false;f.exhausted=true;}}
    f.vy+=( (f.thrusting?3.4:-2.8)-f.vy)*(1-Math.exp(-dt*9));
    player.y=Math.min(ground+MOBILITY.maxAltitude,player.y+f.vy*dt);
    const motion=movePlayer(player,{...controls,sprint:false},dt,gateOpen,{speed:MOBILITY.flightSpeed,acceleration:6,collides:(x,z)=>collidesAtHeight(x,z,player.y,gateOpen)||parkedVehicleBlocked(x,z,state,player.y)});
    const nextGround=terrainHeight(player.x,player.z),support=mobilitySupportHeight(player.x,player.z,state,player.y+.15);
    player.y=Math.min(nextGround+MOBILITY.maxAltitude,player.y);
    if(player.y<=support+.025&&!f.thrusting) {player.y=support;f.airborne=false;f.vy=0;}
    else player.y=Math.max(player.y,support);
    return {...motion,sprinting:false,surface:'air'};
  }
  f.thrusting=false;
  if(!held) {const recoverTime=Math.max(0,dt-f.recoveryRemaining);f.recoveryRemaining=Math.max(0,f.recoveryRemaining-dt);f.energy=Math.min(MOBILITY.maxEnergy,f.energy+MOBILITY.recoveryRate*recoverTime);}
  const raised=player.y>ground+.05;
  const stepLimit=.28,standing=(player.posture||'stand')==='stand';let steppedTo=player.y;
  const forward=Number(!!controls.forward)-Number(!!controls.backward),side=Number(!!controls.right)-Number(!!controls.left);
  const directionLength=Math.hypot(forward,side),heading=movementHeading(player);
  const leadX=directionLength?(-Math.sin(heading)*forward+Math.cos(heading)*side)/directionLength:0;
  const leadZ=directionLength?(-Math.cos(heading)*forward-Math.sin(heading)*side)/directionLength:0;
  // A blocked move zeroes velocity. Keep sampling the held direction so a stair
  // remains valid through the contact frame instead of dropping the raised foot.
  const leadSupport=(x,z,maxHeight)=>directionLength?physicalPropSupport(x+leadX*WORLD.radius,z+leadZ*WORLD.radius,maxHeight):-Infinity;
  const motion=movePlayer(player,controls,dt,gateOpen,{collides:(x,z)=>{
    const rise=terrainHeight(x,z)-terrainHeight(player.x,player.z),distance=Math.hypot(x-player.x,z-player.z);
    if(rise>distance*1.05+.012)return true;
    const blocked=(player.posture&&player.posture!=='stand')?postureBlocked(player,player.posture,gateOpen,x,z):(raised?collidesAtHeight(x,z,player.y,gateOpen):collides(x,z,gateOpen));
    if(!blocked)return parkedVehicleBlocked(x,z,state,player.y);
    if(!standing)return true;
    const ahead=leadSupport(x,z,player.y+stepLimit+.04);
    if(!(ahead>terrainHeight(x,z)+.08&&ahead<=player.y+stepLimit+.04))return true;
    for(let lift=.04;lift<=stepLimit+.001;lift+=.04){const feet=player.y+lift;if(!collidesAtHeight(x,z,feet,gateOpen)&&!parkedVehicleBlocked(x,z,state,feet)){steppedTo=Math.max(steppedTo,feet);return false;}}
    return true;
  }});
  if(motion.moving)player.y=Math.max(player.y,steppedTo);
  const floor=mobilitySupportHeight(player.x,player.z,state,player.y+.08),ahead=leadSupport(player.x,player.z,player.y+stepLimit+.04);
  const onStep=standing&&ahead>terrainHeight(player.x,player.z)+.08&&ahead>=player.y-stepLimit&&ahead<=player.y+stepLimit+.04;
  if(player.y>floor+(raised?.08:.3)&&!onStep){j.airborne=true;j.vy=0;j.time=0;}
  else if(!onStep)player.y=floor;
  return motion;
}
export function mobilityView(player,state,rules) {
  const f=state.flight,v=state.vehicle,altitude=Math.max(0,finite(player.y,terrainHeight(player.x,player.z))-terrainHeight(player.x,player.z));
  const mode=v.mounted?'vehicle':f.airborne?'flight':'foot';
  const status=v.mounted?(v.battery<=0?'电池耗尽 · 停稳下车后充能':'W/S 油门 · A/D 转向 · 鼠标环视 · Space 刹车 · 停稳 F 下车'):insideWreck(player.x,player.z)?'舱内安全锁 · 助推禁用':f.airborne?(f.thrusting?'低空助推 · 松开 G 缓降':'受控下降 · 落地后恢复'):f.liftHeld?'松开 G 后恢复':f.recoveryRemaining>0?'落地冷却':f.energy<MOBILITY.launchEnergy?`充能中 · ${MOBILITY.launchEnergy}% 可起飞`:`G 按住起飞 · 最高 ${MOBILITY.maxAltitude} 米`;
  return {mode,energy:f.energy,altitude,maxAltitude:MOBILITY.maxAltitude,flightActive:f.airborne,flightReady:!f.airborne&&!v.mounted&&!insideWreck(player.x,player.z)&&f.energy>=MOBILITY.launchEnergy&&!f.liftHeld,battery:v.battery,speed:Math.hypot(player.vx||0,player.vz||0),repaired:v.repaired,coupler:v.coupler,mounted:v.mounted,status,
    ...(rules===undefined?{}:{flightDrain:flightDrain(rules),maxFlightSeconds:MOBILITY.maxEnergy/flightDrain(rules)})};
}
