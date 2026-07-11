'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..', 'js');
const context = { window: {}, console, localStorage: (() => { const data = new Map(); return { setItem(k,v){data.set(k,String(v));}, getItem(k){return data.has(k)?data.get(k):null;}, removeItem(k){data.delete(k);} }; })() };
context.window = context; vm.createContext(context);
['config.js','state.js','rules.js','world.js','buildings.js','combat.js','progression.js','save.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'), context, { filename:f }));
const SA = context.StarAbyss;
function state(){ const s=SA.State.create(42); s.mode='playing'; return s; }
test('重量和区域压力使用软惩罚并封顶', () => { const s=state(); Object.keys(s.inventory).forEach(k=>s.inventory[k]=0); s.inventory.iron=100; assert.equal(SA.Rules.weight(s.inventory),50); assert.equal(SA.Rules.weightSpeed(s.inventory),0.5); assert.equal(SA.Rules.weightOxygen(s.inventory),1.5); assert.equal(SA.Rules.zoneOxygen(s,'gravity'),4); s.adaptations.gravity=2; assert.ok(SA.Rules.zoneOxygen(s,'gravity')<3); assert.equal(SA.Rules.zoneSpeed(s,'gravity'),1); });
test('原子消费失败不会部分扣除', () => { const inv={iron:10,energy:0}; assert.equal(SA.Rules.consume(inv,{iron:5,energy:1}),false); assert.deepEqual(inv,{iron:10,energy:0}); });
test('死亡掉落合并且复活可继续行动', () => { const s=state(); s.day=2; s.inventory.iron=9; SA.Rules.die(s); assert.equal(s.inventory.iron,5); assert.equal(s.deathDrop.items.iron,4); s.player.alive=true; s.inventory.iron=4; SA.Rules.die(s); assert.equal(s.deathDrop.items.iron,6); SA.Rules.respawn(s); assert.equal(s.player.oxygen,90); assert.ok(s.player.invulnerable>0); });
test('非战斗撞击死亡不发奖励', () => { const s=state(); const e={hp:1,rewarded:false}; SA.Combat.kill(s,e,'impact'); assert.equal(s.inventory.iron,0); assert.equal(s.kills,0); const e2={hp:1,rewarded:false}; SA.Combat.kill(s,e2,'turret'); assert.equal(s.inventory.iron,2); assert.equal(s.kills,1); });
test('扫描会话优先地下候选、跨工具保留，并在采空后按会话类别接续', () => {
  const s=state();
  s.nodes=[{id:'visible',type:'iron',x:s.player.x+10,y:s.player.y,amount:1,underground:false,revealed:true},{id:'underground',type:'iron',x:s.player.x+20,y:s.player.y,amount:1,underground:true,revealed:false},{id:'next',type:'iron',x:s.player.x+30,y:s.player.y,amount:1,underground:false,revealed:true}];
  SA.World.selectTool(s,'scanner'); SA.World.scan(s);
  assert.equal(s.scanActive,true); assert.equal(s.scanType,'iron'); assert.equal(s.scanTarget,'underground'); assert.equal(s.nodes[1].revealed,true);
  ['harvester','weapon','build','repair'].forEach(tool=>{ SA.World.selectTool(s,tool); assert.equal(s.scanTarget,'underground'); assert.equal(s.scanActive,true); });
  SA.World.selectTool(s,'harvester'); SA.World.harvest(s,{x:s.player.x+30,y:s.player.y});
  assert.equal(s.scanTarget,'underground');
  SA.World.harvest(s,{x:s.player.x+20,y:s.player.y}); assert.equal(s.scanTarget,'visible');
});
test('G 与运行中的会话隔离，扫描器再次选择明确关闭且不会隐式复活', () => {
  const s=state(); s.nodes=[{id:'iron',type:'iron',x:s.player.x+20,y:s.player.y,amount:1,underground:false,revealed:true},{id:'bio',type:'biomass',x:s.player.x+30,y:s.player.y,amount:1,underground:false,revealed:true}];
  SA.World.selectTool(s,'scanner'); SA.World.scan(s); s.scanIndex=1;
  assert.equal(s.scanType,'iron'); assert.equal(SA.World.scanTarget(s).id,'iron');
  SA.World.selectTool(s,'scanner'); assert.equal(s.scanActive,false); assert.equal(s.scanType,null); assert.equal(s.scanTarget,null); assert.equal(s.notices[0].text,'扫描导航已关闭。');
  SA.World.selectTool(s,'harvester'); SA.World.harvest(s,{x:s.nodes[1].x,y:s.nodes[1].y}); assert.equal(s.scanActive,false); assert.equal(s.scanTarget,null);
});
test('无候选、失效植物和缓存只清除目标并保持会话', () => {
  const s=state(); s.scanIndex=6; SA.World.selectTool(s,'scanner'); SA.World.scan(s);
  assert.equal(s.scanActive,true); assert.equal(s.scanType,'cache'); assert.equal(s.scanTarget,null);
  s.plants=[{id:'plant',x:s.player.x+10,y:s.player.y,oxygen:3}]; s.scanIndex=4; SA.World.scan(s); s.player.oxygen=SA.Config.player.oxygen-3; SA.World.usePlant(s);
  assert.equal(s.scanActive,true); assert.equal(s.scanType,'oxygen_plant'); assert.equal(s.scanTarget,null);
  s.caches=[{id:'cache',x:s.player.x+10,y:s.player.y,rewards:{iron:1},collected:false}]; s.scanIndex=6; SA.World.scan(s); SA.World.collectNearby(s);
  assert.equal(s.scanActive,true); assert.equal(s.scanType,'cache'); assert.equal(s.scanTarget,null);
});
test('蓝图会话匹配复合资源并按蓝图类别接续', () => {
  const s=state(); s.scanIndex=5; s.nodes=[{id:'core',type:'energy_core',x:s.player.x+100,y:s.player.y,amount:1,underground:false,revealed:true},{id:'crystal',type:'void_crystal',x:s.player.x+90,y:s.player.y,amount:1,underground:false,revealed:true},{id:'iron',type:'iron',x:s.player.x+10,y:s.player.y,amount:1,underground:false,revealed:true}];
  SA.World.scan(s); assert.equal(s.scanType,'blueprint'); assert.equal(s.scanTarget,'crystal'); s.scanIndex=0; SA.World.harvest(s,{x:s.player.x+90,y:s.player.y}); assert.equal(s.scanTarget,'core');
});
test('存档兼容新旧扫描会话格式', () => {
  const s=state(); s.nodes=[{id:'keep',type:'iron',x:1,y:1,amount:1,underground:false,revealed:true}];
  s.scanActive=true; s.scanType='iron'; s.scanTarget='keep'; let loaded=SA.Save.sanitize(JSON.parse(JSON.stringify(s))); assert.equal(loaded.scanActive,true); assert.equal(loaded.scanType,'iron'); assert.equal(loaded.scanTarget,'keep');
  s.scanTarget='gone'; loaded=SA.Save.sanitize(JSON.parse(JSON.stringify(s))); assert.equal(loaded.scanActive,true); assert.equal(loaded.scanType,'iron'); assert.equal(loaded.scanTarget,null);
  const legacy=JSON.parse(JSON.stringify(s)); delete legacy.scanActive; delete legacy.scanType; legacy.scanTarget='keep'; loaded=SA.Save.sanitize(legacy); assert.equal(loaded.scanActive,true); assert.equal(loaded.scanType,'iron'); assert.equal(loaded.scanTarget,'keep');
  legacy.scanTarget='gone'; loaded=SA.Save.sanitize(legacy); assert.equal(loaded.scanActive,false); assert.equal(loaded.scanType,null); assert.equal(loaded.scanTarget,null);
  s.scanActive=false; s.scanType='iron'; s.scanTarget='keep'; loaded=SA.Save.sanitize(JSON.parse(JSON.stringify(s))); assert.equal(loaded.scanActive,false); assert.equal(loaded.scanType,null); assert.equal(loaded.scanTarget,null);
});
test('建造验证与放置共享规则且预览验证不扣资源', () => { const s=state(); s.buildSelection='turret'; s.inventory.iron=20; s.inventory.void_crystal=5; const point={x:s.player.x+100,y:s.player.y}; assert.equal(SA.Buildings.validatePlacement(s,point).valid,true); const before=JSON.stringify(s.inventory); assert.equal(SA.Buildings.validatePlacement(s,{x:s.base.x,y:s.base.y}).valid,false); assert.equal(JSON.stringify(s.inventory),before); SA.Buildings.place(s,point); assert.equal(s.buildings.length,1); });
test('炮台开火更新瞄准与闪光，已毁炮台不作用', () => { const s=state(); const turret={id:'t',type:'turret',x:s.player.x,y:s.player.y,hp:100,maxHp:100,level:0,timer:0,aimAngle:0,fireFlash:0}; s.buildings=[turret]; s.enemies=[{id:'e',x:turret.x,y:turret.y+50,hp:100,maxHp:100,speed:0,radius:13,attack:0,variant:0,rewarded:false}]; SA.Combat.tick(s,0.01); assert.equal(turret.aimAngle,Math.PI/2); assert.equal(turret.fireFlash,SA.Config.runtime.turretFireFlashDuration); const hp=s.enemies[0].hp; turret.hp=0; turret.timer=0; turret.fireFlash=0; SA.Combat.tick(s,0.01); assert.equal(s.enemies[0].hp,hp); assert.equal(turret.fireFlash,0); });

test('采集无锁定目标时回退到作业范围内最近节点', () => { const s=state(), target={id:'nearby',type:'biomass',x:s.player.x+104,y:s.player.y,amount:1,underground:false,revealed:true}; s.nodes=[target]; SA.World.harvest(s,{x:s.player.x-400,y:s.player.y}); assert.equal(s.inventory.biomass,1); assert.equal(s.nodes.length,0); });
test('建筑建造、升级、维修、回收遵守成本', () => { const s=state(); Object.keys(s.inventory).forEach(k=>s.inventory[k]=100); s.buildSelection='turret'; SA.Buildings.place(s,{x:s.player.x+100,y:s.player.y}); assert.equal(s.buildings.length,1); const b=s.buildings[0]; b.hp=50; s.player.x=b.x; s.player.y=b.y; SA.Buildings.repair(s,b); assert.equal(b.hp,85); SA.Buildings.upgrade(s); assert.equal(b.level,1); const before=s.inventory.iron; SA.Buildings.recycle(s); assert.equal(s.buildings.length,0); assert.ok(s.inventory.iron>before); });
test('炮塔升级在范围外、不足或满级时不扣资源，成功时原子扣除', () => { const s=state(), cost=SA.Config.turretUpgrade.cost, turret={id:'t',type:'turret',x:s.player.x+200,y:s.player.y,hp:100,maxHp:100,level:0,timer:0}; s.buildings=[turret]; Object.keys(s.inventory).forEach(k=>s.inventory[k]=100); const before=JSON.stringify(s.inventory); SA.Buildings.upgrade(s); assert.equal(JSON.stringify(s.inventory),before); assert.match(s.notices[0].text,/距离 200m.*成本：/); turret.x=s.player.x; Object.keys(s.inventory).forEach(k=>s.inventory[k]=0); const insufficient=JSON.stringify(s.inventory); SA.Buildings.upgrade(s); assert.equal(JSON.stringify(s.inventory),insufficient); assert.match(s.notices[0].text,/升级资源不足：.*缺少/); turret.level=SA.Config.turretUpgrade.max; Object.keys(s.inventory).forEach(k=>s.inventory[k]=100); const full=JSON.stringify(s.inventory); SA.Buildings.upgrade(s); assert.equal(JSON.stringify(s.inventory),full); assert.match(s.notices[0].text,/Lv3/); turret.level=0; const successBefore=JSON.parse(JSON.stringify(s.inventory)); SA.Buildings.upgrade(s); assert.equal(turret.level,1); Object.keys(cost).forEach(k=>assert.equal(s.inventory[k],successBefore[k]-cost[k])); assert.match(s.notices[0].text,/已消耗：/); });
test('信号周期、里程碑和撤离幂等', () => { const s=state(); s.inventory.energy=30; s.buildings.push({type:'signal_beacon',timer:0,hp:100,maxHp:100,x:s.base.x+100,y:s.base.y}); SA.Progression.tick(s,12); assert.equal(s.signal.progress,5); assert.equal(s.inventory.energy,29); SA.Progression.setProgress(s,100); assert.equal(s.caches.length,4); assert.equal(s.signal.extractionActive,true); assert.equal(s.mode,'playing'); SA.Progression.setProgress(s,100); assert.equal(s.caches.length,4); });
test('血清公式降低压力', () => { const s=state(); Object.keys(s.inventory).forEach(k=>s.inventory[k]=100); const before=SA.Rules.zoneOxygen(s,'cold'); SA.Progression.craftSerum(s,'cold'); assert.equal(s.adaptations.cold,1); assert.ok(SA.Rules.zoneOxygen(s,'cold')<before); });
test('存档往返、坏版本和撤离零秒边界', () => { const s=state(); s.inventory.iron=17; s.signal.progress=100; s.signal.extractionActive=true; s.forcedNight=true; s.isNight=true; s.signal.extractionRemaining=0; assert.equal(SA.Save.save(s),true); const loaded=SA.Save.load(); assert.equal(loaded.inventory.iron,17); assert.equal(loaded.signal.extractionRemaining,0.1); assert.equal(loaded.forcedNight,true); assert.equal(loaded.isNight,true); assert.equal(SA.Save.sanitize({schema:999}),null); assert.equal(SA.Save.sanitize(null),null); });
