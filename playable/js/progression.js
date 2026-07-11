(function (SA) {
  'use strict';
  var C = SA.Config, R = SA.Rules, W = SA.World;
  function tick(s, dt) {
    var beacon = s.buildings.some(function (b) { return b.type === 'signal_beacon'; });
    if (beacon && s.signal.progress < 100 && !s.signal.extractionActive) {
      s.signal.timer += dt;
      while (s.signal.timer >= C.signal.interval) { s.signal.timer -= C.signal.interval; if (!R.consume(s.inventory, { energy: C.signal.energy })) { s.signal.timer = 0; W.notice(s, '信号台断能：需要 1 能量。'); break; } setProgress(s, s.signal.progress + C.signal.progress); }
    }
    if (s.signal.extractionActive) { s.signal.extractionRemaining = Math.max(0, s.signal.extractionRemaining - dt); s.signal.evacuationSpawnCooldown = Math.max(0, s.signal.evacuationSpawnCooldown - dt); if (s.signal.extractionRemaining <= 0) { s.signal.extractionActive = false; s.signal.extractionComplete = true; s.mode = 'victory'; } }
  }
  function setProgress(s, value) { var old = s.signal.progress; s.signal.progress = Math.max(0, Math.min(100, value)); C.milestones.forEach(function (m) { if (s.signal.progress >= m.at && old < m.at && !s.signal.milestones[m.id]) unlockMilestone(s, m); }); }
  function unlockMilestone(s, m) { s.signal.milestones[m.id] = true; s.signal.latest = m.message; s.signal.log = Array.isArray(s.signal.log) ? s.signal.log : []; if (s.signal.log.indexOf(m.message) < 0) s.signal.log.push(m.message); s.caches.push({ id: m.id, x: m.x, y: m.y, rewards: copy(m.rewards), collected: false }); W.notice(s, m.message); if (m.id === 'signal_100' && !s.signal.extractionActive && !s.signal.extractionComplete) { s.signal.extractionActive = true; s.signal.extractionRemaining = C.signal.extraction; s.signal.evacuationSpawnCooldown = C.signal.evacuationSpawnCooldown; s.forcedNight = true; s.isNight = true; SA.Combat.spawn(s, C.signal.forcedNightWave + s.day * C.signal.forcedNightWavePerDay); SA.Save.save(s); } }
  function craftSerum(s, zone) { var level = s.adaptations[zone], recipe = C.serumRecipes[zone][level]; if (!recipe) return W.notice(s, '该区域适应已达 Lv4。'); if (!R.consume(s.inventory, recipe)) return W.notice(s, '血清材料不足：' + R.costText(recipe)); s.adaptations[zone] += 1; W.notice(s, C.zones[zone].label + '适应提升至 Lv' + s.adaptations[zone] + '。'); }
  function craftKit(s) { var cost = { biomass: 2, energy: 1 }; if (!R.consume(s.inventory, cost)) return W.notice(s, 'O2 Kit 材料不足：' + R.costText(cost)); s.inventory.oxygen_canister += 1; W.notice(s, '已制作 O2 Kit。'); }
  function useKit(s) { if (s.inventory.oxygen_canister <= 0) return W.notice(s, '没有 O2 Kit。'); if (s.player.oxygen >= C.player.oxygen - 1) return W.notice(s, '当前氧气充足。'); s.inventory.oxygen_canister -= 1; s.player.oxygen = Math.min(C.player.oxygen, s.player.oxygen + 60); }
  function objective(s) {
    if (s.signal.extractionActive) return '守住基地，等待撤离 ' + format(s.signal.extractionRemaining);
    if (s.player.oxygen < 45) return '氧气偏低：返回基地、寻找 O2 植株或使用 O2 Kit';
    if (s.isNight) return '夜袭进行中：守住基地并维修受损结构';
    if (s.deathDrop) return '回收上一处死亡掉落';
    var cache = s.caches.some(function (c) { return !c.collected; }); if (cache) return '扫描并回收新解锁的信号缓存';
    if (!s.buildings.some(function (b) { return b.type === 'turret'; })) return '采集资源并建造第一座炮塔';
    if (!s.buildings.some(function (b) { return b.type === 'o2_station'; })) return '建造氧气站扩展探索半径';
    if (!s.buildings.some(function (b) { return b.type === 'solar_panel'; })) return '建造太阳能板稳定获得能量';
    if (!s.buildings.some(function (b) { return b.type === 'research_station'; })) return '建造研究站生产蓝图';
    if (!s.buildings.some(function (b) { return b.type === 'signal_beacon'; })) return '准备材料并建造信号台';
    return s.inventory.energy < 2 ? '补充能量维持信号台' : '维持信号台供能并强化夜间防线';
  }
  function format(sec) { var n = Math.max(0, Math.ceil(sec)); return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'); }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  SA.Progression = { tick: tick, setProgress: setProgress, unlockMilestone: unlockMilestone, craftSerum: craftSerum, craftKit: craftKit, useKit: useKit, objective: objective, format: format };
}(window.StarAbyss = window.StarAbyss || {}));
