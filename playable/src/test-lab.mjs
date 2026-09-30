import {TEST_LAB,resetTestLabStorage} from './test-lab-storage.mjs';
import {localToGlobal,unit,scale,length} from './planet/coordinates.mjs';
import {terrainHeight,collidesAtHeight} from './layout.mjs';
import {definitions} from './expedition-world/definitions.mjs';
import {SURVEY_ROUTE} from './planet-gameplay/progression.mjs';

const realmName=['后天','先天','灵海','金丹','元婴','化神','炼虚','合道','星劫','道源'][TEST_LAB.realm];
const names={basin:'裂环盆地',plains:'长风平原',forest:'河谷森林',wetland:'浅滩湿地',coast:'潮汐海岸',ocean:'深蓝海洋'};
export async function prepareTestLabSession(runtime,isCurrent=()=>true) {
  const root=runtime.snapshot();
  if(!root.worldId?.startsWith('test-lab:'))throw Error('拒绝准备非测试世界');
  if(root.simTime>=17.9)return;
  // One real director pass behind the startup overlay. No invented inventory or enemies.
  for(let i=0;i<360&&isCurrent();i++){
    runtime.tick(.05);
    while(runtime.busy&&isCurrent())await new Promise(resolve=>setTimeout(resolve,0));
    if(isCurrent()&&runtime.view().error)throw Error(runtime.view().error);
  }
  if(isCurrent()&&!await runtime.checkpoint())throw Error(runtime.view().error||'测试场景准备未能保存，请重试。');
}
export function seedTestLabGame({story,mobility,evolution,planet,serialize,discovered,points}) {
  for(const key of Object.keys(story.flags))story.flags[key]=true;
  story.sequence=[2,1,3];story.logs=Object.keys(story.flags);
  Object.assign(mobility.vehicle,{repaired:true,partTaken:true,coupler:true,battery:100,mounted:false});
  Object.assign(evolution,{bodyLevel:3,equipmentLevel:3,footDistance:1500});
  for(const point of points)discovered.add(point.id);
  const data=serialize();
  data.planet.gameplay.progression={surveys:[...SURVEY_ROUTE],commissioned:true};
  data.planet.gameplay.energy=100;
  planet.reset(data);
}

/** Debug adapter: every move reuses planet support/restore; normal action paths remain authoritative. */
export function createTestLab(api) {
  const {planet}=api;let speed=1,open=false,busy=false,flightMode='manual';
  const style=document.createElement('link');style.rel='stylesheet';style.href='./css/test-lab.css';document.head.append(style);
  document.title=`星渊 · ${realmName}测试实验室（独立测试档）`;
  const badge=document.createElement('button');badge.id='test-lab-toggle';badge.textContent=`测试版 · ${realmName} R${TEST_LAB.realm} · F2 实验室`;badge.type='button';document.body.append(badge);
  const dialog=document.createElement('dialog');dialog.id='test-lab-panel';dialog.setAttribute('aria-label','元婴测试实验室');
  dialog.innerHTML=`<header><h2>${realmName}测试实验室</h2><button type="button" data-action="close">收起并游玩</button></header>
    <p>独立测试档 · R${TEST_LAB.realm} ${realmName}一级 · 正式调查与外勤存档不会写入此入口。</p>
    <p class="test-lab-note">元婴 R4 已领悟自身飞行，不依赖装备或载具。正式与测试版均为离地 2,000 米封顶；松开上升键可以悬停。当前仅出生星有已接入的真实 3D 地表。</p>
    <section><h3>境界与能力</h3><label>独立境界档<select id="test-lab-realm">${[4,5,6,7,8,9].map(r=>`<option value="${r}" ${r===TEST_LAB.realm?'selected':''}>R${r} · ${['后天','先天','灵海','金丹','元婴','化神','炼虚','合道','星劫','道源'][r]}</option>`).join('')}</select></label><button data-action="realm">进入该境界独立档</button><p>Shift + WASD 加速；炼虚起 Y 短虚步、Shift + Y 长距预览。空中 R 气刃，星劫起 R 破虚。近地自动限速；高空更适合比较加速。不同境界各自保存；正式成长链尚未开放全部高阶突破。</p><a href="./ascension-gallery.html" target="_blank">查看六境概念与 3D 模型</a></section><output id="test-lab-status" aria-live="polite">等待测试会话</output>
    <section><h3>地图、生境与营地路线</h3><label>目的地<select id="test-lab-destination"></select></label><div class="test-lab-row"><button data-action="travel">前往实景</button><button data-action="route">设为导航目标</button><button data-action="camp">安全返营</button></div></section>
    <section><h3>元婴自身飞行与驾驶</h3><label>飞行模拟速率<select id="test-lab-speed"><option value="0.25">0.25 倍 · 慢速观察</option><option value="1" selected>1 倍 · 原始速度</option><option value="2">2 倍</option><option value="4">4 倍 · 赶路</option></select></label><label>离地高度<select id="test-lab-height"><option value="30">30 米</option><option value="200">200 米</option><option value="1600">1,600 米</option><option value="2000">2,000 米 · 当前星球上限</option></select></label><div class="test-lab-row"><button data-action="height">前往该高度</button><button data-action="land">安全落地</button><button data-action="vehicle">前往勘探车</button></div><p>地面 G 起飞、Space 跳跃；空中 G 上升、C 下降着陆，松开悬停；地面 C 蹲伏、Ctrl 慢走；WASD 航向；V 第一 / 第三人称。F 上下车，车上 Space 刹车。</p></section>
    <section><h3>真实外勤玩法</h3><div class="test-lab-row"><button data-action="combat">前往地面战斗点</button><button data-action="air-combat">前往空战点</button><button data-action="gather">前往采集点</button><button data-action="inventory">打开背包</button></div><p>R 脉冲攻击，H 采集/拾取，I 背包；回营地存取真实物资。盆地外探索地标：落地靠近后按 H 调查，再按 H 采集有限标本，物资进入真实背包；返回营地归档。远区战斗/仓储尚未开放。</p><p>选择“祁岳 · 战技训练区”前往教官附近，K 打开战技面板，按教学要求完成演示并装备；1 使用武器战技，2/3 使用两个主动槽。传送不发放武器、学习成果或奖励。元婴数值会快速击败后天掠兽，仍有真实前摇、命中、掉落和持久化。</p></section>
    <section><h3>逐项检查</h3>${['各生境 3D 与导航','升空、缓降、安全落地','驾驶、停车、上下车','战斗前摇、命中、掉落','采集、背包、营地存取','刷新恢复测试进度'].map(x=>`<label class="test-lab-check"><input type="checkbox">${x}</label>`).join('')}<p>勾选仅为本次人工检查记录，不会伪造玩法完成。</p></section>
    <footer><button data-action="reset">重置独立测试档</button><a href="./star-abyss.html">返回正式入口</a></footer>`;
  document.body.append(dialog);
  const duelSection=document.createElement('section');
  duelSection.innerHTML=`<h3>空中拳脚与格挡</h3><div class="test-lab-row"><button data-action="arena">${TEST_LAB.arena?'准备人形空战陪练':'进入独立空战陪练档'}</button></div><p>左键逐次拳脚，可提前点击衔接左拳 → 右拳 → 上挑踢；按住右键格挡，N/O 兼容。R 保留气刃 / 破虚。先观察对手前摇再格挡，绕到侧后方可突破防御。陪练有真实生命与受击位移；此入口使用额外独立存档。</p><a href="./assets/air-combat-r9/reference.png" target="_blank">查看动作参考图</a>`;
  dialog.querySelector('footer').before(duelSection);
  const beastSection=document.createElement('section');
  beastSection.innerHTML=`<h3>裂翼巡猎兽 · 地空追猎</h3><div class="test-lab-row"><button data-action="riftwing">${TEST_LAB.arena?'前往裂翼巡猎兽':'进入独立地空追猎档'}</button></div><p>同一怪物在地面爪扑、升空追击并俯冲，落地后继续交战。左键拳脚、右键格挡，G 升空、C 下降，R 远攻；击杀后落地按 H 拾取。生命与掉落持久保存，死亡后不会因重进此按钮而复活。</p>`;
  dialog.querySelector('footer').before(beastSection);
  const flightRow=document.createElement('div');flightRow.className='test-lab-row';
  for(const [mode,label] of [['ascend','持续升空'],['hover','悬停'],['descend','持续下降'],['manual','恢复键盘飞行']]){const button=document.createElement('button');button.textContent=label;button.type='button';button.onclick=()=>{try{ready();if(mode==='hover'&&!planet.active)throw Error('请先升空再悬停');flightMode=mode;close();}catch(error){update(error.message);}};flightRow.append(button);}
  dialog.querySelector('#test-lab-height').parentElement.after(flightRow);
  const destinations=[{id:'camp',name:'安全营地',local:{x:0,z:190}},{id:'instructor-N06',name:'祁岳 · 战技训练区',local:{x:-3,z:181}},...planet.field.routeLandmarks.map(p=>({...p,name:names[p.id]||p.id})),...definitions.sites.map(s=>({...s,id:'site:'+s.id,local:s}))];
  for(const d of api.explorationDestinations||[])destinations.push({id:'exploration:'+d.id,name:'探索地标 · '+d.name,position:{...d.position}});
  for(const [id,name,direction] of [['backside','星球背面 · 地表实景',{x:-1,y:0,z:0}],['north-pole','北极 · 地表实景',{x:0,y:1,z:0}],['south-pole','南极 · 地表实景',{x:0,y:-1,z:0}]])destinations.push({id,name,position:planet.field.surfacePoint(direction)});
  const flightHelp=document.createElement('p');flightHelp.textContent='观景跳转与高度按钮会固定升降；WASD 与 Shift 加速仍可用。要用 G/C 自由升降，请点“恢复键盘飞行”。低空限速，升至 350 米后可体验完整航速。';flightRow.after(flightHelp);
  const select=dialog.querySelector('#test-lab-destination');
  for(const d of destinations){const option=document.createElement('option');option.value=d.id;option.textContent=d.name;select.append(option);}
  const status=dialog.querySelector('output');
  function update(message=''){
    const actor=api.runtime()?.snapshot()?.combat.actors.find(a=>a.id===api.link()?.playerId),hud=planet.hud();
    status.textContent=message||`真实会话：${actor?`R${actor.realm} · 生命 ${actor.hp}/${actor.maxHp} · 真气 ${actor.resource}`:'载入中'}\n${planet.location()} · 离地 ${Math.round(hud?.agl||0)} 米 · ${api.ready()?'可操作':'请先开始/继续测试，等待资源就绪'}`;
  }
  function close(){dialog.close();open=false;api.block(false);}
  function show(){open=true;api.block(true);dialog.showModal();update();}
  badge.onclick=show;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  document.addEventListener('keydown',event=>{if(event.code!=='F2'||event.repeat)return;event.preventDefault();event.stopImmediatePropagation();if(open)close();else show();},true);
  for(const type of ['keydown','keyup'])dialog.addEventListener(type,event=>event.stopPropagation());
  function ready(){if(!api.ready())throw Error('请先开始/继续测试并等待真实资源与外勤会话载入。');if(api.runtime()?.busy)throw Error('存档正在提交，请稍后重试。');}
  function localSupport(local){
    for(const radius of [0,3,7,14,24])for(let i=0;i<(radius?16:1);i++){
      const x=local.x+Math.cos(i*Math.PI/8)*radius,z=local.z+Math.sin(i*Math.PI/8)*radius,y=terrainHeight(x,z);
      if(!collidesAtHeight(x,z,y,true,.55,1.85)&&api.queries.canOccupy({x,z},.55)&&!api.queries.dynamicBlocked({x,z}))return localToGlobal({x,y,z},planet.frame);
    }
    throw Error('目标附近没有安全步行支撑，请选择营地。');
  }
  function commit(position){
    const destinationSample=planet.adapter.sample(position);
    if(destinationSample.ready&&destinationSample.agl>2000)position=scale(unit(position),length(position)-(destinationSample.agl-2000));
    const {player,mobility}=api.context();const data=api.serialize();
    data.planet.position=position;data.planet.pose={yaw:player.yaw,heading:player.heading,pitch:0,posture:'stand'};
    if(data.planet.gameplay.surfaceVehicle)data.planet.gameplay.surfaceVehicle.mounted=false;
    data.mobility.vehicle.mounted=false;
    // Keep the six-km parked pose; the authoritative canonical position lives in planet.position.
    const old=structuredClone(mobility);mobility.vehicle.mounted=false;Object.assign(mobility.flight,{airborne:false,liftHeld:false,thrusting:false,vy:0});Object.assign(mobility.jump,{airborne:false,held:false,vy:0,time:0,landing:0});Object.assign(mobility.vehicle,{driveSpeed:0,slipVX:0,slipVZ:0});
    try{planet.reset(data);}catch(error){Object.assign(mobility,old);throw error;}
    flightMode=planet.active?'hover':'manual';api.afterMove();update();
  }
  function travel(d){ready();if(d.local){commit(localSupport(d.local));return;}
    const surface=planet.prepare(d.position);
    if(!surface.ready)throw Error('地形尚未就绪，请重试。');
    // Viewing at 30m avoids trees and water; safe landing is a separately checked action.
    commit(scale(unit(surface.position),length(surface.position)+Math.max(30,(surface.waterDepth||0)+30)));
  }
  function land(){ready();const p=planet.position,surface=planet.prepare(p);
    if(!surface.ready||surface.waterDepth>.15)throw Error('这里没有可用陆地支撑，请选择陆地生境或安全返营。');
    const above=scale(unit(surface.position),length(surface.position)+2);
    if(!planet.adapter.sweep(above,surface.position,.55)?.clear)throw Error('落点有障碍，请移动到开阔位置或返营。');
    commit(surface.position);
  }
  async function action(name){
    if(name==='close'){close();return;}
    if(name==='reset'){if(api.runtime()?.busy)throw Error('存档正在提交，请稍后重试。');api.shutdown();await resetTestLabStorage();location.reload();return;}
    ready();
    if(name==='riftwing'){
      if(!TEST_LAB.arena){const url=new URL(location.href);url.searchParams.set('arena','1');location.href=url.href;return;}
      await api.runtime().action({type:'riftwing-encounter'});
      const target=api.runtime().view().enemies.find(e=>e.kind==='riftwing');
      if(!target)throw Error(api.runtime().view().error||'裂翼兽尚未生成，请稍后重试。');
      travel({local:{x:target.x,z:target.z+6}});
      const p=api.context().player;p.yaw=p.heading=Math.atan2(p.x-target.x,p.z-target.z);p.pitch=0;flightMode='manual';api.afterMove();
      update(target.alive?'已前往裂翼兽附近。收起面板，左键拳脚、右键格挡；G 起飞观察展翼追击，C 落地继续交战。':'裂翼兽已被击杀；可落地 H 拾取剩余战利品。此按钮不会重刷。');return;
    }
    if(name==='arena'){
      if(!TEST_LAB.arena){const url=new URL(location.href);url.searchParams.set('arena','1');location.href=url.href;return;}
      await api.runtime().action({type:'air-sparring'});
      const target=api.runtime().view().enemies.find(e=>e.sparring&&e.alive);
      if(!target)throw Error(api.runtime().view().error||'陪练尚未生成，请稍后重试。');
      const y=target.y??terrainHeight(target.x,target.z)+12;
      commit(localToGlobal({x:target.x,y,z:target.z+1.55},planet.frame));
      const p=api.context().player,aim=planet.aimAtLocal({x:target.x,y:y+1,z:target.z});p.yaw=p.heading=aim.yaw;p.pitch=aim.pitch;
      flightMode='manual';api.afterMove();update('人形陪练已准备。收起面板，左键出拳并衔接三连，按住右键格挡；C 落地。');return;
    }
    if(name==='realm'){const url=new URL(location.href);url.searchParams.set('realm',dialog.querySelector('#test-lab-realm').value);location.href=url.href;return;}
    if(name==='air-combat'){const target=api.runtime().view().enemies.find(e=>e.alive);if(!target)throw Error('当前没有存活掠兽，请重置当前境界测试档。');const x=target.x+14,z=target.z+14,y=terrainHeight(x,z)+12;commit(localToGlobal({x,y,z},planet.frame));const p=api.context().player,aim=planet.aimAtLocal({x:target.x,y:(target.y??terrainHeight(target.x,target.z))+1,z:target.z});p.yaw=p.heading=aim.yaw;p.pitch=aim.pitch;api.afterMove();update('已悬停并瞄准真实掠兽。收起面板按 R 发动空战；WASD 可躲避红色反击，落地 H 拾取。');}
    if(name==='travel')travel(destinations.find(d=>d.id===select.value));
    if(name==='camp')travel(destinations[0]);
    if(name==='route'){const d=destinations.find(d=>d.id===select.value),data=api.serialize();data.planet.navigationTarget={id:d.id,name:d.name,position:d.position||localSupport(d.local)};planet.reset(data);api.afterMove();update('已设置真实行星导航目标。收起面板后沿导航行进。');}
    if(name==='height'){const p=planet.position,s=planet.prepare(p);if(!s.ready)throw Error('地形未就绪');const h=Math.max(0,Math.min(2000,Number(dialog.querySelector('#test-lab-height').value)||0));commit(scale(unit(p),length(s.position)+Math.max(h,(s.waterDepth||0)+h)));}
    if(name==='land')land();
    if(name==='vehicle'){
      const v=api.context().mobility.vehicle,localVehicle=Math.max(Math.abs(v.x),Math.abs(v.z))<=2990&&Math.abs((v.y??terrainHeight(v.x,v.z))-terrainHeight(v.x,v.z))<5;
      if(localVehicle)travel({local:{x:v.x+2.8,z:v.z}});
      else{const data=api.serialize(),parked=data.planet.gameplay.surfaceVehicle?.position;if(!parked)throw Error('没有已保存的车辆');const p=planet.adapter.advance(parked,{east:2.8,north:0,up:0}),s=planet.prepare(p);if(!s.ready)throw Error('车辆地形未就绪');commit(scale(unit(p),length(s.position)+3));}
      const p=api.context().player;p.yaw=p.heading=Math.atan2(p.x-v.x,p.z-v.z);api.afterMove();update('已前往车辆附近，收起面板，落地后按 F 上车。');
    }
    if(name==='combat'){const target=api.runtime().view().enemies.find(e=>e.alive);if(!target)throw Error('测试档中当前没有存活掠兽；可重置测试档后再测。');travel({local:{x:target.x+8,z:target.z+8}});const p=api.context().player;p.yaw=p.heading=Math.atan2(p.x-target.x,p.z-target.z);api.afterMove();update('已前往真实存活掠兽附近；收起面板，靠近到4米内按 R。');}
    if(name==='gather'){const resource=api.runtime().view().resources.find(r=>r.remaining>0),target=resource&&definitions.resources.find(r=>r.id===resource.id);if(!target)throw Error('当前没有可采集资源；等待真实生态刷新或重置测试档。');travel({local:{x:target.x+2,z:target.z}});update('已前往真实可采集资源旁；收起面板后按 H。');}
    if(name==='inventory'){if(!planet.legacyActive())travel(destinations[0]);close();api.inventory();}
  }
  dialog.addEventListener('click',async event=>{const button=event.target.closest('button[data-action]');if(!button||busy)return;busy=true;dialog.dataset.busy='true';try{update('正在准备真实场景，请稍候…');await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));await action(button.dataset.action);}catch(error){update(error.message);}finally{busy=false;dialog.dataset.busy='false';}});
  dialog.querySelector('#test-lab-speed').onchange=event=>{speed=Number(event.target.value);update(`飞行模拟速率 ${speed} 倍；真实碰撞、能量和高度限制仍启用。`);};
  return {get open(){return open;},show,travel,land,refresh(){if(open)update();},
    step(controls,dt){if(open)return true;if(flightMode!=='manual')controls={...controls,lift:flightMode==='ascend',descend:flightMode==='descend',jump:false};const factor=planet.active?speed:1;let handled=false;for(let remaining=dt*factor;remaining>1e-8;remaining-=.05)handled=planet.step(controls,Math.min(.05,remaining))||handled;return handled;},
    snapshot(){return {namespace:TEST_LAB,open,speed,flightMode,ready:api.ready()};},
  };
}
