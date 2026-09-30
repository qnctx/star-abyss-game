import * as THREE from 'three';
import {createPlanetField} from './planet/field.mjs';
import {createPlanetTerrain} from './planet/scene-adapter.mjs';
import {tangentFrame,localToGlobal,globalToLocal,toGeodetic,unit,dot,length,scale,add,createFloatingOrigin} from './planet/coordinates.mjs';
import {flightAimInLocal,flightAimAtLocal} from './planet/flight-aim.mjs';
import {createRuntimeWorld,restorePlanet,attachPlanet,createFlight,createProgression,progressionView,progressAction,stepFlight,flightControls,cameraEnvelope,chaseCameraPosition,flightAvatarVisible,clearFlightInput} from './planet-gameplay/index.mjs';
import {configureWorldExtension,legacyTerrainHeight,collidesAtHeight,insideWreck} from './layout.mjs';
import {createPlanetParking,isLegacyPose} from './planet-parking.mjs';
import {createPlanetEcology} from './planet-ecology.mjs';
import {MOBILITY} from './mobility.mjs';
import {createPlanetMap,sphericalNavigation} from './planet-map.mjs';
import {sampleTerrainContact,advanceVerticalContact} from './terrain-contact.mjs';
import {altitudeTerrainPolicy,installLegacyGroundFade} from './planet/high-altitude.mjs';
import {previewAscensionStep,commitAscensionStep,advanceFlightAbilityTime,applyFlightKnockback} from './planet-gameplay/flight.mjs';
import {realmFlightRules,blinkRules} from './planet-gameplay/ascension-rules.mjs';

const realmNames=['后天','先天','灵海','金丹','元婴','化神','炼虚','合道','星劫','道源'];
const blinkMessages={'realm-locked':'炼虚境界才可使用空间瞬移。','insufficient-energy':'灵息不足。','cooldown':'虚步尚在冷却。','terrain-pending':'沿途或落点地形尚未就绪，请缩短距离或升至开阔高空。','blocked':'路径存在障碍，不能穿越。','unsafe-surface':'落点或路径不安全。','stale-preview':'位置已变化，请重新预览。','distance-limit':'超出当前境界的瞬移距离。'};

const names={basin:'裂环盆地',plains:'长风平原',forest:'河谷森林',wetland:'浅滩湿地',coast:'潮汐海岸',ocean:'深蓝海洋',mountains:'高地山脉',river:'河流',cliff:'断崖'};
export function createPlanetRuntime({world,getContext,toast}) {
  // 11.8 base relief + 241 landforms + 8*3.2 faults + 30 crater rims < 310m;
  // all fades and triangle interpolation are convex. This is an actual bound.
  const frame=tangentFrame(),field=createPlanetField({legacyHeight:legacyTerrainHeight,legacyMaxHeight:310,frame});
  const terrain=createPlanetTerrain({THREE,scene:world.scene,field,renderFrame:frame,legacyMaskHalfSize:3000});
  let session=null,parking=null,lastStream=null,epoch=0,ecology=null,originalEnvelope=null;
  let chaseCamera=null,lastCameraTime=null,lastCameraMode=null,duelCameraOffset=0;
  let airRecoil=null,lastAirImpulse=null;
  const heightCache=new Map();
  const restoringSurfaces=new Map();
  const restoringVehicles=new Map();
  let groundMotion={vy:0,grounded:true};
  const positionKey=p=>`${p.x},${p.y},${p.z}`;
  const floating=createFloatingOrigin({origin:frame.origin});
  let renderUndo=null,legacyGroundFade=null;
  let map=null,navigationTarget=null,explorationMap=[];
  let lastBlink=null;
  const toLocal=p=>globalToLocal(p,frame),toGlobal=p=>localToGlobal(p,frame);
  const rotate=p=>new THREE.Vector3(dot(p,frame.east),dot(p,frame.up),dot(p,frame.south));
  function stream(position,force=false,pump=false) {
    if(!force&&!pump)return; // only one normal pump in updateScene, never per simulation substep
    if(!force&&!terrain.pending&&lastStream&&Math.hypot(position.x-lastStream.x,position.y-lastStream.y,position.z-lastStream.z)<24)return;
    const revision=terrain.revision;terrain.update(position,force?{}:{budgetMs:3,maxLoads:1});lastStream={...position};
    if(terrain.revision!==revision){heightCache.clear();epoch++;}
  }
  function localSurface(x,z) {
    if(Math.max(Math.abs(x),Math.abs(z))<=3000)return {height:legacyTerrainHeight(x,z),ready:true,waterDepth:0,biomes:{basin:1},slope:0};
    if(x*x+z*z>field.planet.radius**2*.8)return {ready:false};
    const key=x.toFixed(3)+','+z.toFixed(3);if(heightCache.has(key))return heightCache.get(key);
    let y=Math.sqrt(field.planet.radius**2-x*x-z*z)-field.planet.radius,s;
    for(let i=0;i<4;i++){
      const p=toGlobal({x,y,z});s=terrain.sampleRenderedSurface(p);if(!s.ready||s.spacing>30)return {ready:false};
      y=Math.sqrt(Math.max(0,(field.planet.radius+s.height)**2-x*x-z*z))-field.planet.radius;
    }
    const result={...s,height:y};if(heightCache.size>2000)heightCache.clear();heightCache.set(key,result);return result;
  }
  function vehicleContact(position,yaw=0){
    if(dot(unit(position),frame.up)>.99){
      const local=toLocal(position);
      if(Math.max(Math.abs(local.x),Math.abs(local.z))<2995){
        const contact=sampleTerrainContact({height:legacyTerrainHeight,x:local.x,z:local.z,yaw});
        const point=toGlobal({...local,y:contact.height});
        return {...contact,position:point,altitude:length(point)-field.planet.radius,surfaceNormal:contact.normal,waterDepth:0};
      }
    }
    const geo=toGeodetic(position,field.planet.radius),basis=tangentFrame(geo.lat,geo.lon,field.planet.radius);
    let waterDepth=0;
    const contact=sampleTerrainContact({x:0,z:0,yaw,height:(x,z)=>{
      const probe=add(scale(basis.up,field.planet.radius),add(scale(basis.east,x),scale(basis.south,z)));
      const s=terrain.sampleRenderedSurface(probe);
      if(!s.ready||s.spacing>30)return NaN;
      waterDepth=Math.max(waterDepth,s.waterDepth||0);
      return dot(s.position,basis.up)-field.planet.radius;
    }});
    if(!contact.ready)return contact;
    const normal=add(scale(basis.east,contact.normal.x),add(scale(basis.up,contact.normal.y),scale(basis.south,contact.normal.z)));
    return {...contact,position:scale(basis.up,field.planet.radius+contact.height),altitude:contact.height,surfaceNormal:rotate(normal),waterDepth};
  }
  function solidSweep(from,to,radius) {
    if(Number.isFinite(field.maxSurfaceHeight)){
      const d={x:to.x-from.x,y:to.y-from.y,z:to.z-from.z},den=dot(d,d),t=den?Math.max(0,Math.min(1,-dot(from,d)/den)):0;
      if(length(add(from,scale(d,t)))>field.planet.radius+field.maxSurfaceHeight+100+radius)return {ready:true,clear:true};
    }
    const a=toLocal(from),b=toLocal(to),count=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)/.3));
    for(let i=0;i<=count;i++){
      const t=i/count,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};
      const canonical=toGlobal(p);
      if(p.y<410&&dot(unit(canonical),frame.up)>.99&&Math.max(Math.abs(p.x),Math.abs(p.z))<2990&&collidesAtHeight(p.x,p.z,p.y,getContext().story.flags.gateOpen,radius,1.85))return {ready:true,clear:false};
      if(ecology?.blockedCanonical?.(canonical,radius,1.85))return {ready:true,clear:false};
    }
    return {ready:true,clear:true};
  }
  const adapter=createRuntimeWorld({field,
    loaded:p=>{if(restoringSurfaces.has(positionKey(p)))return true;const s=field.sample(p);return length(p)-field.planet.radius-s.height>100||terrain.isReady(p,30);},
    sampleTerrain:(p,raw)=>{if(length(p)-field.planet.radius-raw.height>100)return raw;const s=restoringSurfaces.get(positionKey(p))||terrain.sampleRenderedSurface(p);return s.ready?{...raw,...s}:null;},
    solidSweep,serviceAt:p=>{const camp=toGlobal({x:0,y:legacyTerrainHeight(0,190),z:190});return Math.hypot(p.x-camp.x,p.y-camp.y,p.z-camp.z)<14;}});
  adapter.sampleVehicle=(p,yaw=0)=>{
    const base=adapter.sample(p),support=restoringVehicles.get(positionKey(p))||vehicleContact(p,yaw);
    if(!base.ready||!support.ready)return {...base,ready:false};
    const agl=length(p)-field.planet.radius-support.altitude;
    return {...base,agl,grounded:Math.abs(agl)<=.15,supportPosition:support.position,waterDepth:Math.max(base.waterDepth||0,support.waterDepth||0)};
  };
  configureWorldExtension({
    height:(x,z)=>localSurface(x,z).height??0,
    blocked:(x,z,radius,feet)=>{
      const s=localSurface(x,z);if(!s.ready||s.waterDepth>.18)return true;
      for(const [dx,dz]of [[radius,0],[-radius,0],[0,radius],[0,-radius]]){const side=localSurface(x+dx,z+dz);if(!side.ready||side.waterDepth>.18)return true;}
      return ecology?.blocked(x,z,radius,feet??s.height)||false;
    },surface:(x,z)=>{const s=localSurface(x,z);return (s.biomes?.cliff||0)>.3?'rock':(s.biomes?.coast||0)>.3?'dust':'gravel';}
  });
  stream(toGlobal({x:0,y:0,z:190}),true);
  ecology=createPlanetEcology({THREE,scene:world.scene,field,frame,terrain});
  function syncGround(){if(session&&!session.flight.active)session.flight.position=toGlobal(getContext().player);}
  function radialFrame(){return !!session&&(session.flight.active||dot(unit(session.flight.position),frame.up)<.94);}
  function legacyActive(){const c=getContext();return !session?.flight.active&&isLegacyPose(c.player)&&dot(unit(toGlobal(c.player)),frame.up)>.99&&Math.abs(c.player.y-legacyTerrainHeight(c.player.x,c.player.z))<5;}
  function applyPosition(){Object.assign(getContext().player,toLocal(session.flight.position));}
  function reset(snapshot){
    airRecoil=null;lastAirImpulse=null;
    lastBlink=null;
    chaseCamera=null;lastCameraTime=null;lastCameraMode=null;
    snapshot={...snapshot,player:{...snapshot.player,y:snapshot.player.y??legacyTerrainHeight(snapshot.player.x,snapshot.player.z)}};
    getContext().player.y=snapshot.player.y;
    originalEnvelope=snapshot.planet;parking=createPlanetParking(snapshot);
    navigationTarget=null;explorationMap=[];
    const target=snapshot.planet?.navigationTarget;
    if(target?.position&&['x','y','z'].every(k=>Number.isFinite(target.position[k]))&&length(target.position)>field.planet.radius*.8&&length(target.position)<field.planet.radius*1.2)navigationTarget={id:String(target.id||'point'),name:String(target.name||'地图目标').slice(0,60),position:{...target.position}};
    const p=snapshot.planet?.position||toGlobal(snapshot.player);stream(p,true);
    const savedVehicle=snapshot.planet?.gameplay?.surfaceVehicle,v=savedVehicle?.position;if(v){terrain.update(v);const sample=terrain.sampleRenderedSurface(v);if(sample.ready)restoringSurfaces.set(positionKey(v),sample);const support=vehicleContact(v,savedVehicle.yaw);if(support.ready)restoringVehicles.set(positionKey(v),support);terrain.update(p);}
    try{session=restorePlanet(snapshot,getContext(),adapter,toGlobal);}finally{restoringSurfaces.clear();restoringVehicles.clear();}
    if(session.writable===false)throw new Error('星球存档暂不可恢复（'+session.status+'），已保留原始记录');
    applyPosition();getContext().player.vx=0;getContext().player.vz=0;
    const pose=snapshot.planet?.pose;
    if(pose){if(!['yaw','heading','pitch'].every(k=>Number.isFinite(pose[k]))||Math.abs(pose.pitch)>1.35)throw new Error('星球朝向记录无效，原存档已保留');Object.assign(getContext().player,{yaw:pose.yaw%(Math.PI*2),heading:pose.heading%(Math.PI*2),pitch:pose.pitch,posture:['stand','crouch','prone'].includes(pose.posture)?pose.posture:'stand'});}
    groundMotion={vy:0,grounded:!session.flight.active};
    if(session.surfaceVehicle){const v=session.surfaceVehicle;Object.assign(getContext().mobility.vehicle,toLocal(v.position),{yaw:v.yaw,battery:v.battery,mounted:v.mounted,vy:v.vy||0,grounded:v.grounded!==false});}
    return session;
  }
  function save(snapshot){
    if(!session)return snapshot;
    syncGround();
    const c=getContext(),v=c.mobility.vehicle;
    const previous=session.surfaceVehicle?.position,previousLocal=previous?toLocal(previous):null;
    let vehiclePosition=previous;
    if(!previousLocal||Math.hypot(previousLocal.x-v.x,previousLocal.z-v.z)>.001||Number.isFinite(v.y)&&Math.abs(previousLocal.y-v.y)>.001){
      const height=Number.isFinite(v.y)?v.y:Math.max(Math.abs(v.x),Math.abs(v.z))<=3000?legacyTerrainHeight(v.x,v.z):localSurface(v.x,v.z).height;
      if(!Number.isFinite(height))throw new Error('停车地形尚未就绪，暂不覆盖存档');
      vehiclePosition=toGlobal({x:v.x,y:height,z:v.z});
    }
    session.surfaceVehicle={position:vehiclePosition,yaw:v.yaw,battery:v.battery,mounted:v.mounted,grounded:v.grounded!==false,vy:v.vy||0};
    const base=parking.snapshot(snapshot,legacyActive());
    const saved=attachPlanet({...base,...(originalEnvelope?{planet:originalEnvelope}:{})},session,adapter);
    saved.planet.pose={yaw:c.player.yaw,heading:c.player.heading??c.player.yaw,pitch:c.player.pitch,posture:c.player.posture||'stand'};
    saved.planet.navigationTarget=navigationTarget?structuredClone(navigationTarget):null;
    return saved;
  }
  function stepMotion(controls,dt){
    if(!session)return false;const c=getContext();syncGround();stream(session.flight.position);
    const progress=progressionView(session.progression,c);
    if(!session.flight.active&&radialFrame()&&(!controls.lift||c.mobility.vehicle.mounted||!progress.unlocked)){
      const mounted=c.mobility.vehicle.mounted;
      let speed=controls.sprint?7:4.2;
      if(mounted){
        const v=c.mobility.vehicle,brake=!!controls.lift,throttle=Number(!!controls.forward)-Number(!!controls.backward),maxSpeed=v.battery>0?(controls.sprint?MOBILITY.vehicleBoost:MOBILITY.vehicleSpeed):0;
        const current=-(c.player.vx||0)*Math.sin(v.yaw)-(c.player.vz||0)*Math.cos(v.yaw),target=brake?0:throttle*(throttle<0?Math.min(maxSpeed,10):maxSpeed);
        const rate=brake?28:throttle&&Math.sign(throttle)!==Math.sign(current)&&Math.abs(current)>.2?18:throttle?9:5;
        speed=current+Math.max(-rate*dt,Math.min(rate*dt,target-current));
        v.yaw+=(Number(!!controls.left)-Number(!!controls.right))*Math.tan(.48)*speed/6*dt;
        c.player.yaw=c.player.heading=v.yaw;c.player.vx=-Math.sin(v.yaw)*speed;c.player.vz=-Math.cos(v.yaw)*speed;
      }
      const direction=flightControls(mounted?{forward:true}:controls,c.player.heading??c.player.yaw),norm=Math.max(1,Math.hypot(direction.east,direction.north));
      const from=session.flight.position,probe=adapter.advance(from,{east:direction.east/norm*speed*dt,north:direction.north/norm*speed*dt,up:0});
      const ground=terrain.sampleRenderedSurface(probe),contact=mounted?vehicleContact(probe,c.mobility.vehicle.yaw):null;
      const current=mounted?vehicleContact(from,c.mobility.vehicle.yaw):terrain.sampleRenderedSurface(from);
      const supportHeight=mounted?contact.altitude:ground.height,currentHeight=mounted?current.altitude:current.height;
      const travel=Math.abs(speed)*dt,horizontalAllowed=Number.isFinite(supportHeight)&&Number.isFinite(currentHeight)&&supportHeight-currentHeight<=travel*.8+.08;
      let destination=horizontalAllowed?probe:from;
      let destinationHeight=horizontalAllowed?supportHeight:currentHeight;
      if(ground.ready&&ground.spacing<=30&&ground.waterDepth<=.18&&(!mounted||contact.ready&&contact.waterDepth<=.18)&&current.ready){
        const state=mounted?c.mobility.vehicle:groundMotion;
        const vertical=advanceVerticalContact({y:length(from)-field.planet.radius,vy:state.vy||0,grounded:state.grounded!==false},destinationHeight,dt,{snapDistance:Math.max(.25,travel*.85),gravity:14});
        const target=scale(unit(destination),field.planet.radius+vertical.y),sweep=solidSweep(from,target,mounted?1.1:.42);
        if(sweep.clear&&!ecology?.blockedCanonical?.(target,mounted?1.1:.42,mounted?1.3:1.85)){
          session.flight.position=target;applyPosition();
          Object.assign(state,{vy:vertical.vy,grounded:vertical.grounded});
          if(mounted){const distance=Math.hypot(target.x-from.x,target.y-from.y,target.z-from.z);Object.assign(c.mobility.vehicle,{x:c.player.x,y:c.player.y,z:c.player.z,surfaceNormal:(horizontalAllowed?contact:current).surfaceNormal,battery:Math.max(0,c.mobility.vehicle.battery-distance*(controls.sprint?MOBILITY.vehicleBoostConsumption:MOBILITY.vehicleConsumption))});session.surfaceVehicle={position:{...target},yaw:c.mobility.vehicle.yaw,battery:c.mobility.vehicle.battery,mounted:true,grounded:vertical.grounded,vy:vertical.vy};}
          if(!horizontalAllowed){c.player.vx=0;c.player.vz=0;}
        }else if(mounted){c.player.vx=0;c.player.vz=0;}
      }else if(mounted){c.player.vx=0;c.player.vz=0;}
      return true;
    }
    const localWreck=dot(unit(session.flight.position),frame.up)>.99&&insideWreck(c.player.x,c.player.z);
    if(!session.flight.active&&(!progress.unlocked||c.mobility.vehicle.mounted||localWreck))return false;
    const wasActive=session.flight.active,result=stepFlight(session.flight,flightControls(controls,c.player.yaw),dt,progress.unlocked,adapter,{realm:c.realm,clockAdvanced:true});
    if(result.handled||wasActive){
      applyPosition();c.player.vx=0;c.player.vz=0;c.player.posture='stand';
      Object.assign(c.mobility.flight,{airborne:false,thrusting:false,liftHeld:false,vy:0});
      Object.assign(c.mobility.jump,{airborne:false,held:false,vy:0,time:0,landing:0});
    }
    return result.handled||wasActive;
  }
  function step(controls,dt){
    if(session)advanceFlightAbilityTime(session.flight,dt);
    if(airRecoil&&session?.flight.active){
      const duration=.55,t=Math.min(Math.max(0,dt),.05,airRecoil.remaining),elapsed=duration-airRecoil.remaining;
      // Exact integrated easing: each accepted impulse is a displacement in metres.
      const factor=(Math.exp(-3*elapsed/duration)-Math.exp(-3*(elapsed+t)/duration))/(1-Math.exp(-3));
      const geo=toGeodetic(session.flight.position,field.planet.radius),basis=tangentFrame(geo.lat,geo.lon,field.planet.radius);
      const vector=add(scale(frame.east,airRecoil.dx),add(scale(frame.up,airRecoil.dy),scale(frame.south,airRecoil.dz)));
      const result=applyFlightKnockback(session.flight,{east:dot(vector,basis.east)*factor,north:-dot(vector,basis.south)*factor,up:dot(vector,basis.up)*factor},adapter);
      lastAirImpulse={...lastAirImpulse,result:result.reason};
      airRecoil.remaining-=t;if(!result.ok||airRecoil.remaining<=1e-9||result.landed)airRecoil=null;
      applyPosition();return true;
    }
    airRecoil=null;
    const handled=stepMotion(controls,dt),v=getContext().mobility.vehicle;
    if(handled&&!v.mounted){v.battery=Math.min(MOBILITY.vehicleCapacity,v.battery+dt*MOBILITY.parkedCharge);if(session.surfaceVehicle)session.surfaceVehicle.battery=v.battery;}
    return handled;
  }
  function airImpulse(impulse){
    if(!session?.flight.active||!impulse||!['dx','dy','dz'].every(k=>Number.isFinite(impulse[k])))return false;
    if(lastAirImpulse?.id===impulse.id)return false;
    const magnitude=Math.hypot(impulse.dx,impulse.dy,impulse.dz),limit=Math.min(1,12/Math.max(1,magnitude));
    airRecoil={dx:impulse.dx*limit,dy:impulse.dy*limit,dz:impulse.dz*limit,remaining:.55};
    clearFlightInput(session.flight);lastAirImpulse={id:impulse.id,kind:impulse.kind,result:'pending'};return true;
  }
  function blinkPreview(mode='short'){
    const c=getContext();
    if(!session||c.mobility.vehicle.mounted||!session.flight.active)return {ok:false,reason:'flight-required',message:'请先按 G 起飞，再使用虚步。'};
    const yaw=c.player.yaw,pitch=c.player.pitch||0;
    const result=previewAscensionStep(session.flight,{mode,east:-Math.sin(yaw)*Math.cos(pitch),north:-Math.cos(yaw)*Math.cos(pitch),up:Math.sin(pitch)},adapter,{realm:c.realm});
    return {...result,message:result.ok?'路径和落点已验证':blinkMessages[result.reason]||'当前无法瞬移。'};
  }
  function blinkCommit(ticket){
    const c=getContext();
    if(!session||c.mobility.vehicle.mounted||!session.flight.active)return {ok:false,message:'当前不能瞬移。'};
    const origin={...session.flight.position},result=commitAscensionStep(session.flight,ticket,adapter,{realm:c.realm});
    if(result.ok){applyPosition();c.player.vx=c.player.vz=0;chaseCamera=null;lastCameraTime=null;lastBlink={serial:result.serial,realm:c.realm,from:toLocal(origin),to:toLocal(session.flight.position),yaw:c.player.yaw,mode:ticket.request.mode};}
    return {...result,message:result.ok?'虚步完成':blinkMessages[result.reason]||'瞬移取消。'};
  }
  function combatZone(){
    if(!session)return false;const p=toLocal(session.flight.position);
    return dot(unit(session.flight.position),frame.up)>.99&&Math.abs(p.x)<2990&&Math.abs(p.z)<2990&&adapter.sample(session.flight.position).ready===true;
  }
  function action(){
    if(!session)return;syncGround();const c=getContext(),progress=progressionView(session.progression,c),sample=adapter.sample(session.flight.position);
    const result=progressAction(session.progression,progress.action,c,sample);
    toast(result.changed?(progress.action==='commission'?'生态调查完成。自身飞行需达到元婴 R4。':'生态样本已记录，继续前往下一片地貌。'):progress.unlocked?'元婴自身飞行：G 起飞 / 升高，空中按 C 下降着陆，松开悬停。':progress.title+'；在安全地面停车后按 P。');
    return result.changed;
  }
  function vehicleAction(){
    if(!session||session.flight.active)return false;const c=getContext(),v=c.mobility.vehicle,parked=session.surfaceVehicle;
    if(!v.repaired||!parked)return false;
    if(v.mounted){
      if(v.grounded===false||Math.abs(v.vy||0)>.1||Math.hypot(c.player.vx||0,c.player.vz||0)>2){toast('请先接地并松开油门或按 Space 刹车，停稳后再下车。');return false;}
      const candidate=adapter.advance(session.flight.position,{east:2.4,north:0,up:0}),surface=terrain.sampleRenderedSurface(candidate);
      if(!surface.ready||surface.waterDepth>.15||ecology?.blockedCanonical?.(surface.position,.42,1.85)){toast('这一侧无法安全下车，请换一处平坦地面。');return false;}
      v.mounted=false;parked.mounted=false;c.player.vx=0;c.player.vz=0;session.flight.position=surface.position;applyPosition();toast('已停稳下车。');return true;
    }
    if(Math.hypot(...['x','y','z'].map(k=>session.flight.position[k]-parked.position[k]))>3.2)return false;
    v.mounted=true;parked.mounted=true;session.flight.position={...parked.position};applyPosition();c.player.yaw=c.player.heading=v.yaw;toast('已进入勘探车。');return true;
  }
  function objective(){
    if(!session||!getContext().story.flags.complete)return null;
    const progress=progressionView(session.progression,getContext());
    return {title:progress.unlocked?`${realmNames[getContext().realm]||'元婴'}御空 · 离地最高 2,000 米`:progress.title,detail:progress.unlocked?'G 起飞 / 上升 · C 下降 · Shift 加速 · Y 短虚步 / Shift+Y 长距预览（炼虚起）· R 空战 · Space 地面跳跃':'沿东行河谷连续探索；P 采样 / 营地整备。',target:null};
  }
  function navigation(){
    if(!session||(!getContext().story.flags.complete&&!navigationTarget))return null;
    const progress=progressionView(session.progression,getContext());
    const landmark=field.routeLandmarks?.find(p=>p.biome===progress.biome||p.id===progress.biome);
    if(!navigationTarget&&!landmark&&progress.action!=='commission')return null;
    const canonical=navigationTarget?.position||landmark?.position||toGlobal({x:0,y:legacyTerrainHeight(0,190),z:190});
    const p=toLocal(canonical),player=getContext().player,{distance,bearing:initial}=sphericalNavigation(session.flight.position,canonical,field.planet.radius),bearing=initial??0;
    return {kind:navigationTarget?'custom':'task',target:{id:navigationTarget?.id||'planet-'+(progress.biome||'camp'),name:navigationTarget?.name||(progress.action==='commission'?'返回营地':names[progress.biome]),hint:navigationTarget?'已到达行星标点附近':'停车站稳后按 P 采样 / 整备',x:p.x,y:p.y,z:p.z,renderPosition:toLocal(add(canonical,scale(unit(canonical),2))),aboveHorizon:dot(unit(session.flight.position),unit(canonical))>field.planet.radius/Math.max(field.planet.radius,length(session.flight.position)+30)},distance,arrived:distance<30,bearing,relativeBearing:((bearing+player.yaw*180/Math.PI+540)%360+360)%360-180};
  }
  function mapState(){return {position:session.flight.position,vehicle:session.surfaceVehicle?{position:session.surfaceVehicle.position,parked:!getContext().mobility.vehicle.mounted}:null,progression:session.progression,exploration:explorationMap};}
  function ensureMap(){return map??=createPlanetMap({field,camp:toGlobal({x:0,y:legacyTerrainHeight(0,190),z:190})});}
  function mapView(markers){if(!session)return null;if(Array.isArray(markers))explorationMap=markers;syncGround();return {...ensureMap().render(mapState()),outside:!legacyActive(),status:api.hud().coordinateLabel||'裂环盆地 · 营地所在大陆'};}
  function setMapTarget(selection){
    if(!session)return false;
    if(!selection){navigationTarget=null;return true;}
    const target=selection.id?ensureMap().select(selection.id,mapState()):ensureMap().pick(selection,mapState());
    if(!target)return false;navigationTarget={id:target.id,name:target.name,position:target.position};return true;
  }
  function updateScene(view,objects){
    if(!session)return;syncGround();stream(session.flight.position,false,true);const {camera,scene}=objects;
    const s=adapter.sample(session.flight.position);if(!s.ready)return;
    const envelope=cameraEnvelope(s,field.planet.radius),high=session.flight.active,radial=radialFrame();
    // Keep the visual transition independent of which mesh currently answers contact.
    // Otherwise small LOD height differences can toggle mask ownership near the threshold.
    const visualAgl=length(session.flight.position)-field.planet.radius-field.sample(session.flight.position).height;
    const terrainPolicy=altitudeTerrainPolicy(visualAgl),blend=terrain.root.children.length?terrainPolicy.legacyBlend:0,preserveLocal=blend<1;
    legacyGroundFade??=installLegacyGroundFade(objects.ground);legacyGroundFade.set(blend);
    terrain.setLegacyMaskEnabled?.(preserveLocal);terrain.setLegacyBlend?.(blend);objects.ground.visible=preserveLocal;
    camera.near=high?Math.max(envelope.near,Math.max(0,s.agl)*.0001):.08;camera.far=Math.max(11000,envelope.far);camera.fov=high?envelope.fov:72;
    if(radial){
      const p=session.flight.position,g=toGeodetic(p,field.planet.radius),basis=tangentFrame(g.lat,g.lon,field.planet.radius);
      const up=rotate(basis.up),east=rotate(basis.east),north=rotate(scale(basis.south,-1)),local=toLocal(p),yaw=view.player.yaw,pitch=view.player.pitch;
      const forward=north.multiplyScalar(Math.cos(yaw)).addScaledVector(east,-Math.sin(yaw));forward.multiplyScalar(Math.cos(pitch)).addScaledVector(up,Math.sin(pitch));
      if(envelope.globe>0)forward.lerp(up.clone().negate(),envelope.globe*.7).normalize();
      camera.up.copy(up);camera.position.set(local.x,local.y,local.z).addScaledVector(up,1.72);
      const firstPerson=view.cameraMode==='first'||view.cameraMode==='vehicle-first';
      const opponent=view.combat?.aerialMelee?.opponents?.find(e=>e.alive!==false&&Math.hypot(e.x-local.x,e.y-local.y,e.z-local.z)<6);
      const closeDuel=opponent&&Math.abs(Math.atan2(Math.sin(Math.atan2(local.x-opponent.x,local.z-opponent.z)-yaw),Math.cos(Math.atan2(local.x-opponent.x,local.z-opponent.z)-yaw)))<.8;
      if(!firstPerson){
        const eye=camera.position.clone(),desired=eye.clone().addScaledVector(up,.25+Math.min(.35,Math.max(0,session.flight.speed||0)/420*.35)).addScaledVector(forward,-envelope.distance);
        const mode=view.cameraMode,now=Number.isFinite(view.time)?view.time:null;
        const dt=now===null||lastCameraTime===null?1/60:Math.max(0,Math.min(.1,now-lastCameraTime));
        duelCameraOffset+=((closeDuel?1.1:0)-duelCameraOffset)*(1-Math.exp(-6*dt));
        desired.addScaledVector(new THREE.Vector3().crossVectors(forward,up).normalize(),duelCameraOffset);
        chaseCamera=chaseCameraPosition(lastCameraMode===mode?chaseCamera:null,{x:desired.x,y:desired.y,z:desired.z},dt);
        camera.position.set(chaseCamera.x,chaseCamera.y,chaseCamera.z);
        if(s.agl<50){
          const boom=camera.position.clone().sub(eye),distance=boom.length();
          for(let d=.4;d<=distance+.4;d+=.4){const test=eye.clone().addScaledVector(boom,Math.min(d,distance)/Math.max(.001,distance)),canonical=toGlobal(test),surface=terrain.sampleRenderedSurface(canonical);if(!surface.ready||length(canonical)-field.planet.radius<surface.height+.22){camera.position.copy(eye).addScaledVector(boom,Math.max(0,d-.5)/Math.max(.001,distance));break;}}
          chaseCamera={x:camera.position.x,y:camera.position.y,z:camera.position.z};
        }
        lastCameraMode=mode;lastCameraTime=now;
      }else{
        chaseCamera=null;lastCameraMode=view.cameraMode;lastCameraTime=null;
      }
      camera.lookAt(camera.position.clone().add(forward));objects.avatar.visible=flightAvatarVisible(view.cameraMode);
      const basisMatrix=new THREE.Matrix4().makeBasis(rotate(basis.east),up,rotate(basis.south));
      objects.avatar.quaternion.setFromRotationMatrix(basisMatrix).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),view.player.heading??yaw));
    }else{camera.up.set(0,1,0);chaseCamera=null;lastCameraTime=null;lastCameraMode=null;}
    if(objects.skimmer&&session.surfaceVehicle){
      const vehicle=session.surfaceVehicle,p=vehicle.mounted?session.flight.position:vehicle.position;
      if(dot(unit(p),frame.up)<.94){
        const g=toGeodetic(p,field.planet.radius),basis=tangentFrame(g.lat,g.lon,field.planet.radius),local=toLocal(p);
        objects.skimmer.position.set(local.x,local.y,local.z);
        const support=vehicleContact(p,vehicle.yaw),up=support.ready?new THREE.Vector3(support.surfaceNormal.x,support.surfaceNormal.y,support.surfaceNormal.z).normalize():rotate(basis.up);
        const heading=rotate(basis.south).multiplyScalar(Math.cos(vehicle.yaw)).addScaledVector(rotate(basis.east),Math.sin(vehicle.yaw));heading.addScaledVector(up,-heading.dot(up)).normalize();
        const right=new THREE.Vector3().crossVectors(up,heading).normalize();
        objects.skimmer.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,heading));
        if(vehicle.mounted)objects.avatar.quaternion.copy(objects.skimmer.quaternion);
      }
    }
    camera.updateProjectionMatrix();
    scene.fog.density=terrainPolicy.fogDensity;
    // Keep the existing purple sky and ringed distant body centered at the camera.
    objects.sky.position.copy(camera.position);objects.stars.position.copy(camera.position);
    objects.sky.material.uniforms.orbitalMix.value=Math.min(1,Math.max(0,s.agl-2000)/20000);
    objects.ringPlanet.position.set(camera.position.x+2150,camera.position.y+2130,camera.position.z-6400);objects.ringGroup.position.copy(objects.ringPlanet.position);
    objects.dust.visible=!high&&s.agl<10;
    ecology?.update(session.flight.position);
    // Rebase the entire drawing frame together. Gameplay, collision and saves
    // retain their canonical/anchor coordinates; restore them after the draw.
    if(high&&s.agl>5000){
      floating.update(toGlobal(camera.position));
      const shift=rotate({x:floating.origin.x-frame.origin.x,y:floating.origin.y-frame.origin.y,z:floating.origin.z-frame.origin.z});
      const objectsToMove=new Set(scene.children);
      scene.traverse(object=>{if(object.isLight&&object.target&&!object.target.parent)objectsToMove.add(object.target);});
      for(const object of objectsToMove)object.position.sub(shift);
      renderUndo=()=>{for(const object of objectsToMove)object.position.add(shift);camera.updateMatrixWorld(true);};
    }
  }
  const api={field,terrain,adapter,frame,reset,save,step,syncGround,legacyActive,radialFrame,action,vehicleAction,objective,navigation,mapView,setMapTarget,updateScene,blinkPreview,blinkCommit,combatZone,airImpulse,
    combatPose(){if(!session)return null;const c=getContext(),position=session.flight.position,local=toLocal(position),aim=flightAimInLocal({position,yaw:c.player.yaw,pitch:c.player.pitch||0,frame,radius:field.planet.radius});return {...local,yaw:aim.yaw,pitch:aim.pitch};},
    aimAtLocal(target){if(!session)return null;return flightAimAtLocal({position:session.flight.position,target,frame,radius:field.planet.radius});},
    get lastBlink(){return lastBlink;},prepare(position){stream(position,true);return terrain.sampleRenderedSurface(position);},
    pause(){if(session)clearFlightInput(session.flight);},
    rescue(){if(!session)return;airRecoil=null;lastAirImpulse=null;const c=getContext();session.flight=createFlight(toGlobal(c.player));session.status='active';parking.rescue(c.player,c.mobility);},
    vehicleRadial(){return !!session?.surfaceVehicle&&dot(unit(session.surfaceVehicle.position),frame.up)<.94;},
    flightUnlocked(){return !!session&&progressionView(session.progression,getContext()).unlocked;},
    get active(){return !!session?.flight.active;},get position(){return session?.flight.position;},
    get parkedPlayer(){return parking?.pose()||getContext().player;},
    location(){if(!session)return names.basin;const s=adapter.sample(session.flight.position);return names[s.biome]||names.basin;},
    hud(){if(!session)return null;const context=getContext(),progress=progressionView(session.progression,context),sample=adapter.sample(session.flight.position),geo=toGeodetic(session.flight.position,field.planet.radius),rules=realmFlightRules(context.realm);return {unlocked:progress.unlocked,active:session.flight.active,realm:context.realm,realmName:realmNames[context.realm]||'元婴',boosting:session.flight.boosting===true,cruiseLimit:rules.cruise,boostLimit:rules.boost,blinkShort:blinkRules(context.realm,'short')?.distance||0,blinkLong:blinkRules(context.realm,'long')?.distance||0,blinkCooldown:Math.max(0,(session.flight.blinkCooldownUntil||0)-(session.flight.abilityTime||0)),energy:session.flight.energy,speed:session.flight.speed,verticalSpeed:session.flight.verticalSpeed,turnBank:session.flight.turnBank||0,maxAgl:2000,altitude:sample.altitude,agl:sample.agl,coordinateLabel:legacyActive()?null:`纬度 ${(geo.lat*180/Math.PI).toFixed(3)}° · 经度 ${(geo.lon*180/Math.PI).toFixed(3)}°`};},
    finishScene(){renderUndo?.();renderUndo=null;},
    airImpulseSnapshot(){return {active:!!airRecoil,last:lastAirImpulse};},
    setEcology(value){ecology=value;},snapshot(){return {epoch,originRevision:floating.revision,renderOrigin:floating.origin,legacyActive:legacyActive(),session:structuredClone(session),chunks:terrain.root.children.length};},
    dispose(){configureWorldExtension(null);ecology?.dispose();terrain.destroy();}
  };
  world.setPlanetController(api);return api;
}
