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
    for (var i = 0; i < count; i += 1) { var a = SA.State.rng(s) * Math.PI * 2, r = world.dailyResourceMinRadius + SA.State.rng(s) * world.dailyResourceRadiusRange; s.nodes.push(SA.State.node(s, choices[Math.floor(SA.State.rng(s) * choices.length)], s.base.x + Math.cos(a) * r, s.base.y + Math.sin(a) * r, underground, underground ? 3 : 4)); }
  }
  function collectNearby(s) {
    if (s.deathDrop && R.distance(s.player, s.deathDrop) < C.runtime.deathDropCollectRange) { R.add(s.inventory, s.deathDrop.items); s.deathDrop = null; notice(s, '已回收死亡掉落。'); }
    s.caches.forEach(function (c) { if (!c.collected && R.distance(s.player, c) < C.runtime.cacheCollectRange) { c.collected = true; if (s.scanTarget === c.id) s.scanTarget = null; R.add(s.inventory, c.rewards); notice(s, '信号缓存已回收：' + R.costText(c.rewards)); } });
    scanTarget(s);
  }
  function harvestableNodes(s) { return s.nodes.filter(function (n) { return n.amount > 0 && (!n.underground || n.revealed); }); }
  function targetIsValid(target) { return !!target && (target.amount === undefined || target.amount > 0) && (target.oxygen === undefined || target.oxygen > 0) && !target.collected; }
  function scanCandidates(s, type) {
    type = type || C.scanTypes[s.scanIndex];
    if (type === 'oxygen_plant') return s.plants.filter(targetIsValid);
    if (type === 'cache') return s.caches.filter(targetIsValid);
    if (type === 'blueprint') return s.nodes.filter(function (n) { return targetIsValid(n) && (n.type === 'energy_core' || n.type === 'void_crystal'); });
    return s.nodes.filter(function (n) { return targetIsValid(n) && n.type === type; });
  }
  function sortScanCandidates(s, candidates) { return candidates.sort(function (a, b) { var ua = a.underground && !a.revealed ? 0 : 1, ub = b.underground && !b.revealed ? 0 : 1; return ua - ub || R.distance(s.player, a) - R.distance(s.player, b); }); }
  function scanTarget(s) { var id = s.scanTarget, target; if (!id) return null; target = s.nodes.concat(s.plants, s.caches).filter(function (x) { return x.id === id; })[0] || null; if (!targetIsValid(target)) { s.scanTarget = null; return null; } return target; }
  function lockNextScanCandidate(s, type) { var pool = sortScanCandidates(s, scanCandidates(s, type)); s.scanTarget = pool[0] ? pool[0].id : null; if (pool[0] && pool[0].underground) pool[0].revealed = true; return pool[0] || null; }
  function harvest(s, point) {
    var nodes = harvestableNodes(s), locked = s.scanActive ? scanTarget(s) : null, target = nearestAt(nodes, point, C.runtime.harvestTargetRange);
    if (!target && locked && nodes.indexOf(locked) >= 0 && R.distance(s.player, locked) <= C.runtime.harvestPlayerRange) target = locked;
    if (!target) target = nearestAt(nodes, s.player, C.runtime.harvestPlayerRange);
    if (!target || R.distance(s.player, target) > C.runtime.harvestPlayerRange) return notice(s, '采集器：作业范围内没有可采节点。');
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
    var type = C.scanTypes[s.scanIndex], target;
    s.scanActive = true;
    s.scanType = type;
    target = lockNextScanCandidate(s, type);
    notice(s, target ? '扫描锁定：' + scanLabel(type) : '扫描：当前没有该类目标，导航会话已开启。');
  }
  function scanLabel(t) { return t === 'oxygen_plant' ? 'O2 植株' : t === 'cache' ? '信号缓存' : t === 'blueprint' ? '研究素材' : C.resources[t].label; }
  function usePlant(s) { var p = nearestAt(s.plants.filter(function (x) { return x.oxygen > 0; }), s.player, C.runtime.plantUseRange); if (p) { var amount = Math.min(p.oxygen, C.player.oxygen - s.player.oxygen); p.oxygen -= amount; s.player.oxygen += amount; if (p.oxygen <= 0 && s.scanTarget === p.id) s.scanTarget = null; if (amount) notice(s, 'O2 植株补充 ' + Math.round(amount) + ' 秒氧气。'); } scanTarget(s); }
  function nearestAt(items, point, radius) { var best = null, d = radius; items.forEach(function (x) { var n = R.distance(x, point); if (n < d) { d = n; best = x; } }); return best; }
  function notice(s, text) { s.notices.unshift({ text: text, time: C.runtime.noticeDuration }); s.notices = s.notices.slice(0, C.runtime.noticeLimit); }
  SA.World = { dailySupply: dailySupply, collectNearby: collectNearby, harvest: harvest, harvestableNodes: harvestableNodes, scanCandidates: scanCandidates, scanTarget: scanTarget, scan: scan, selectTool: selectTool, usePlant: usePlant, nearestAt: nearestAt, notice: notice, scanLabel: scanLabel };
}(window.StarAbyss = window.StarAbyss || {}));
