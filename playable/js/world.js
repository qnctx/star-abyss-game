(function (SA) {
  'use strict';
  var R = SA.Rules, C = SA.Config;
  function dailySupply(s) {
    var visible = s.nodes.filter(function (n) { return n.amount > 0 && !n.underground; }).length;
    var underground = s.nodes.filter(function (n) { return n.amount > 0 && n.underground; }).length;
    var world = C.world;
    spawn(s, Math.min(world.dailyVisibleSpawn, world.visibleCap - visible), false); spawn(s, Math.min(world.dailyUndergroundSpawn, world.undergroundCap - underground), true);
  }
  function spawn(s, count, underground) {
    var choices = underground ? ['void_crystal', 'energy_core', 'iron'] : ['iron', 'biomass', 'void_crystal'], world = C.world;
    for (var i = 0; i < count; i += 1) { var point = dailySpawnPoint(s); s.nodes.push(SA.State.node(s, choices[Math.floor(SA.State.rng(s) * choices.length)], point.x, point.y, underground, underground ? 3 : 4)); }
  }
  function dailySpawnPoint(s) {
    var world = C.world, margin = world.edgeMargin || 0, point, attempts = 0;
    do {
      var angle = SA.State.rng(s) * Math.PI * 2, radius = world.dailyResourceMinRadius + SA.State.rng(s) * world.dailyResourceRadiusRange;
      point = { x: s.base.x + Math.cos(angle) * radius, y: s.base.y + Math.sin(angle) * radius };
      attempts += 1;
    } while (attempts < 24 && !R.pointInWorld(point, margin));
    point.x = R.clamp(point.x, margin, world.width - margin); point.y = R.clamp(point.y, margin, world.height - margin);
    return point;
  }
  function collectNearby(s) {
    if (s.deathDrop && R.pointInWorld(s.deathDrop) && zoneIsNavigable(s, scanZone(s, s.deathDrop)) && R.distance(s.player, s.deathDrop) < C.runtime.deathDropCollectRange) { R.add(s.inventory, s.deathDrop.items); s.deathDrop = null; notice(s, '已回收死亡掉落。'); }
    s.caches.forEach(function (c) { if (!c.collected && R.pointInWorld(c) && zoneIsNavigable(s, scanZone(s, c)) && R.distance(s.player, c) < C.runtime.cacheCollectRange) { c.collected = true; if (s.scanTarget === c.id) s.scanTarget = null; R.add(s.inventory, c.rewards); notice(s, '信号缓存已回收：' + R.costText(c.rewards)); } });
    scanTarget(s);
  }
  function nodeHasMaterial(n) { return R.pointInWorld(n) && n.amount > 0 && (!n.underground || n.revealed); }
  function harvestableNodes(s) { return s.nodes.filter(function (n) { return nodeHasMaterial(n) && zoneIsNavigable(s, scanZone(s, n)); }); }
  function inaccessibleHarvestNodes(s) { return s.nodes.filter(function (n) { return nodeHasMaterial(n) && !zoneIsNavigable(s, scanZone(s, n)); }); }
  function targetIsValid(target) { return R.pointInWorld(target) && (target.amount === undefined || target.amount > 0) && (target.oxygen === undefined || target.oxygen > 0) && !target.collected; }
  function matchingScanCandidates(s, type) {
    type = type || C.scanTypes[s.scanIndex];
    if (type === 'oxygen_plant') return s.plants.filter(targetIsValid);
    if (type === 'cache') return s.caches.filter(targetIsValid);
    if (type === 'blueprint') return s.nodes.filter(function (n) { return targetIsValid(n) && (n.type === 'energy_core' || n.type === 'void_crystal'); });
    return s.nodes.filter(function (n) { return targetIsValid(n) && n.type === type; });
  }
  function scanZone(s, target) { return R.zoneAt(target.x, target.y); }
  function zoneIsNavigable(s, zone) { return zone === R.zoneAt(s.player.x, s.player.y) || s.adaptations[zone] >= C.zones[zone].recommend; }
  function scanRange(s) { return C.scanner.baseRange + (s.scannerLevel || 0) * C.scanner.rangePerLevel; }
  function navigationVisible(s) { return !!s.scanActive && (s.tool === 'scanner' || s.tool === 'harvester'); }
  function targetInScanRange(s, target) { return R.distance(s.player, target) <= scanRange(s); }
  function scanCandidates(s, type) { return matchingScanCandidates(s, type).filter(function (target) { return targetInScanRange(s, target) && zoneIsNavigable(s, scanZone(s, target)); }); }
  function sortScanCandidates(s, candidates) {
    var playerZone = R.zoneAt(s.player.x, s.player.y);
    return candidates.sort(function (a, b) {
      var sameZoneA = scanZone(s, a) === playerZone ? 0 : 1, sameZoneB = scanZone(s, b) === playerZone ? 0 : 1;
      return sameZoneA - sameZoneB || R.distance(s.player, a) - R.distance(s.player, b) || (a.underground ? 0 : 1) - (b.underground ? 0 : 1);
    });
  }
  function scanTarget(s) { var id = s.scanTarget, target; if (!id) return null; target = s.nodes.concat(s.plants, s.caches).filter(function (x) { return x.id === id; })[0] || null; if (!targetIsValid(target)) { s.scanTarget = null; return null; } return target; }
  function lockNextScanCandidate(s, type) { var pool = sortScanCandidates(s, scanCandidates(s, type)); s.scanTarget = pool[0] ? pool[0].id : null; if (pool[0] && pool[0].underground) pool[0].revealed = true; return pool[0] || null; }
  function refreshScan(s) {
    var target;
    if (!s.scanActive || !s.scanType) return null;
    target = scanTarget(s);
    if (target && targetInScanRange(s, target) && zoneIsNavigable(s, scanZone(s, target))) return target;
    s.scanTarget = null;
    return lockNextScanCandidate(s, s.scanType);
  }
  function harvestTarget(s, point) { var target = nearestAt(harvestableNodes(s), point, C.runtime.harvestTargetRange); return target && R.distance(s.player, target) <= C.runtime.harvestPlayerRange ? target : null; }
  function harvestBlockedTarget(s, point) { var target = nearestAt(inaccessibleHarvestNodes(s), point, C.runtime.harvestTargetRange); return target && R.distance(s.player, target) <= C.runtime.harvestPlayerRange ? target : null; }
  function harvest(s, point) {
    var target = harvestTarget(s, point), blocked = harvestBlockedTarget(s, point);
    if (!target) { if (blocked) return notice(s, '采集器：目标位于未适应区域，无法跨区作业。'); return notice(s, '采集器：请点击作业范围内的目标节点。'); }
    target.amount -= 1; s.inventory[target.type] += 1; notice(s, '采集 ' + C.resources[target.type].label + '：取得 1，节点剩余 ' + target.amount);
    if (target.amount <= 0) {
      var wasLocked = s.scanActive && s.scanTarget === target.id;
      s.nodes.splice(s.nodes.indexOf(target), 1);
      if (wasLocked) lockNextScanCandidate(s, s.scanType);
    }
  }
  function closeScanSession(s) { s.scanActive = false; s.scanType = null; s.scanTarget = null; }
  function selectTool(s, tool) {
    if (tool === 'scanner' && s.tool === 'scanner' && s.scanActive) {
      closeScanSession(s);
      notice(s, '扫描导航已关闭。');
      return;
    }
    s.tool = tool;
  }
  function scan(s) {
    var type = C.scanTypes[s.scanIndex], target, matches, inRange, hasUnsafeCandidates, hasOutOfRangeCandidates;
    s.scanActive = true;
    s.scanType = type;
    matches = matchingScanCandidates(s, type);
    inRange = matches.filter(function (candidate) { return targetInScanRange(s, candidate); });
    hasUnsafeCandidates = inRange.length > scanCandidates(s, type).length;
    hasOutOfRangeCandidates = matches.length > inRange.length;
    target = lockNextScanCandidate(s, type);
    notice(s, target ? '扫描锁定：' + scanLabel(type) : hasUnsafeCandidates ? '扫描：范围内匹配资源位于未适应区域，暂无安全导航目标。' : hasOutOfRangeCandidates ? '扫描：当前范围 ' + scanRange(s) + 'm 内没有匹配资源，最近目标在范围外。' : '扫描：当前没有该类目标，导航会话已开启。');
  }
  function upgradeScanner(s) {
    var scanner = C.scanner;
    if (R.distance(s.player, s.base) > scanner.upgradeRange) return notice(s, '扫描器升级：需回到基地核心 ' + scanner.upgradeRange + 'm 内。');
    if (s.scannerLevel >= scanner.maxLevel) return notice(s, '扫描器已达 Lv' + s.scannerLevel + '（最高等级）。');
    if (!R.consume(s.inventory, scanner.upgradeCost)) return notice(s, '扫描器升级资源不足：' + R.costText(scanner.upgradeCost) + '。');
    s.scannerLevel += 1;
    notice(s, '扫描器升级至 Lv' + s.scannerLevel + '，范围 ' + scanRange(s) + 'm。');
  }
  function scanLabel(t) { return t === 'oxygen_plant' ? 'O2 植株' : t === 'cache' ? '信号缓存' : t === 'blueprint' ? '研究素材' : C.resources[t].label; }
  function oxygenRefillAvailable(s) { return R.distance(s.player, s.base) < C.base.oxygenRadius || s.buildings.some(function (b) { return b.hp > 0 && b.type === 'o2_station' && R.distance(s.player, b) < C.buildings.o2_station.range; }); }
  function refillOxygen(s) { if (!oxygenRefillAvailable(s)) return false; var changed = s.player.oxygen < C.player.oxygen; s.player.oxygen = C.player.oxygen; return changed; }
  function usePlant(s) { var p = nearestAt(s.plants.filter(function (x) { return R.pointInWorld(x) && x.oxygen > 0 && zoneIsNavigable(s, scanZone(s, x)); }), s.player, C.runtime.plantUseRange); if (p) { var amount = Math.min(p.oxygen, C.player.oxygen - s.player.oxygen); p.oxygen -= amount; s.player.oxygen += amount; if (p.oxygen <= 0 && s.scanTarget === p.id) s.scanTarget = null; if (amount) notice(s, 'O2 植株补充 ' + Math.round(amount) + ' 秒氧气。'); } scanTarget(s); }
  function nearestAt(items, point, radius) { var best = null, d = radius; items.forEach(function (x) { var n = R.distance(x, point); if (n < d) { d = n; best = x; } }); return best; }
  function notice(s, text) { s.notices.unshift({ text: text, time: C.runtime.noticeDuration }); s.notices = s.notices.slice(0, C.runtime.noticeLimit); }
  SA.World = { dailySupply: dailySupply, collectNearby: collectNearby, harvest: harvest, harvestTarget: harvestTarget, harvestBlockedTarget: harvestBlockedTarget, harvestableNodes: harvestableNodes, scanCandidates: scanCandidates, scanTarget: scanTarget, scan: scan, refreshScan: refreshScan, scanRange: scanRange, navigationVisible: navigationVisible, upgradeScanner: upgradeScanner, selectTool: selectTool, oxygenRefillAvailable: oxygenRefillAvailable, refillOxygen: refillOxygen, usePlant: usePlant, nearestAt: nearestAt, notice: notice, scanLabel: scanLabel, scanZone: scanZone, zoneIsNavigable: zoneIsNavigable };
}(window.StarAbyss = window.StarAbyss || {}));
