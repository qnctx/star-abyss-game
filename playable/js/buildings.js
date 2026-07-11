(function (SA) {
  'use strict';
  var C = SA.Config, R = SA.Rules, W = SA.World;
  function validatePlacement(s, point) {
    var def = C.buildings[s.buildSelection];
    if (!def) return { valid: false, reason: '未知建筑。', def: null };
    if (!s.unlocked[s.buildSelection]) return { valid: false, reason: '科技未解锁。', def: def };
    if (R.distance(s.player, point) > C.runtime.buildRange) return { valid: false, reason: '需靠近工程师。', def: def };
    if (R.distance(s.base, point) < C.runtime.buildBaseClearance) return { valid: false, reason: '需远离基地核心。', def: def };
    if (s.buildings.some(function (b) { return R.distance(b, point) < C.runtime.buildSpacing; })) return { valid: false, reason: '需与其他建筑保持间距。', def: def };
    return { valid: true, reason: '', def: def };
  }
  function place(s, point) {
    var placement = validatePlacement(s, point), def = placement.def;
    if (!placement.valid) return W.notice(s, '建造位置无效：' + placement.reason);
    if (!R.consume(s.inventory, def.cost)) return W.notice(s, '资源不足：' + R.costText(def.cost));
    s.buildings.push({ id: SA.State.id(s, 'building'), type: s.buildSelection, x: point.x, y: point.y, hp: def.hp, maxHp: def.hp, level: 0, timer: 0, aimAngle: 0, fireFlash: 0 });
    W.notice(s, '已建造 ' + def.label + '。');
  }
  function nearest(s, point, radius) { return W.nearestAt(s.buildings, point, radius); }
  function nearestTurret(s, point, radius) { return W.nearestAt(s.buildings.filter(function (b) { return b.type === 'turret'; }), point, radius); }
  function repair(s, point) { var b = nearest(s, point, C.runtime.repairTargetRange); if (!b || R.distance(s.player, b) > C.runtime.repairRange) return W.notice(s, '维修：没有近距离结构。'); if (b.hp >= b.maxHp) return W.notice(s, '结构无需维修。'); if (!R.consume(s.inventory, C.repair.cost)) return W.notice(s, '维修资源不足。'); b.hp = Math.min(b.maxHp, b.hp + C.repair.amount); W.notice(s, '已维修 ' + C.buildings[b.type].label + '。'); }
  function recycle(s) { var b = nearest(s, s.player, C.runtime.recycleRange); if (!b) return W.notice(s, '附近没有可回收结构。'); var cost = C.buildings[b.type].cost, refund = {}; Object.keys(cost).forEach(function (k) { refund[k] = Math.max(1, Math.floor(cost[k] * 0.5)); }); R.add(s.inventory, refund); s.buildings.splice(s.buildings.indexOf(b), 1); W.notice(s, '结构已回收：' + R.costText(refund)); }
  function missingText(inventory, cost) { return Object.keys(cost).filter(function (k) { return (inventory[k] || 0) < cost[k]; }).map(function (k) { return C.resources[k].label + ' 缺 ' + (cost[k] - (inventory[k] || 0)); }).join(' / '); }
  function upgrade(s) {
    var range = C.runtime.turretUpgradeRange, b = nearestTurret(s, s.player, range), cost = C.turretUpgrade.cost;
    if (!b) {
      var turret = s.buildings.filter(function (x) { return x.type === 'turret'; }).sort(function (a, b) { return R.distance(s.player, a) - R.distance(s.player, b); })[0];
      return W.notice(s, turret ? '升级：最近炮塔距离 ' + Math.round(R.distance(s.player, turret)) + 'm（范围 ' + range + 'm），成本：' + R.costText(cost) : '升级：没有炮塔，成本：' + R.costText(cost));
    }
    if (b.level >= C.turretUpgrade.max) return W.notice(s, '升级：炮塔已达 Lv' + b.level + '（最高等级）。');
    if (!R.has(s.inventory, cost)) return W.notice(s, '升级资源不足：' + R.costText(cost) + '；缺少 ' + missingText(s.inventory, cost) + '。');
    R.consume(s.inventory, cost);
    b.level += 1;
    W.notice(s, '炮塔升级至 Lv' + b.level + '，已消耗：' + R.costText(cost) + '。');
  }
  function unlock(s) { var id = s.buildSelection, cost = C.unlocks[id]; if (!cost || s.unlocked[id]) return W.notice(s, '当前建筑无需解锁。'); if (!R.consume(s.inventory, cost)) return W.notice(s, '蓝图不足。'); s.unlocked[id] = true; W.notice(s, C.buildings[id].label + ' 已解锁。'); }
  function tick(s, dt) {
    var shield = 0;
    s.buildings.forEach(function (b) {
      if (b.hp <= 0) return;
      if (b.type === 'solar_panel' && !s.isNight) { b.timer += dt; while (b.timer >= C.runtime.solarInterval) { b.timer -= C.runtime.solarInterval; s.inventory.energy += 1; } }
      if (b.type === 'research_station') { b.timer += dt; while (b.timer >= C.runtime.researchInterval && s.inventory.energy >= C.runtime.researchEnergy) { b.timer -= C.runtime.researchInterval; s.inventory.energy -= C.runtime.researchEnergy; s.inventory.blueprint += 1; W.notice(s, '研究站产出 1 蓝图。'); } }
      if (b.type === 'shield_generator') shield += C.base.shieldPerGenerator;
      if (R.zoneAt(b.x, b.y) === 'heat' && s.adaptations.heat < 2) { var before = b.hp; b.hp -= C.runtime.buildingHeatDamage * dt; if (Math.floor(before / 10) > Math.floor(Math.max(0, b.hp) / 10)) W.notice(s, C.buildings[b.type].label + ' 正受高温侵蚀，耐久 ' + Math.max(0, Math.ceil(b.hp)) + '。'); }
    });
    s.base.shield = Math.min(shield, s.base.shield + C.base.shieldRecharge * dt);
    s.buildings = s.buildings.filter(function (b) { return b.hp > 0; });
  }
  SA.Buildings = { validatePlacement: validatePlacement, place: place, repair: repair, recycle: recycle, upgrade: upgrade, unlock: unlock, tick: tick, nearest: nearest, nearestTurret: nearestTurret };
}(window.StarAbyss = window.StarAbyss || {}));
