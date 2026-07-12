(function (SA) {
  'use strict';
  var C = SA.Config, R = SA.Rules, W = SA.World;
  function Renderer(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.camera = { x: C.world.baseX, y: C.world.baseY }; this.dpr = 1; this.resize(); }
  Renderer.prototype.resize = function () { var r = this.canvas.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1); this.canvas.width = Math.max(640, Math.round(r.width * this.dpr)); this.canvas.height = Math.max(360, Math.round(r.height * this.dpr)); };
  Renderer.prototype.worldPoint = function (screen) { return { x: this.camera.x + (screen.x - this.canvas.width / 2) / this.dpr, y: this.camera.y + (screen.y - this.canvas.height / 2) / this.dpr }; };
  Renderer.prototype.draw = function (s) {
    var ctx = this.ctx, w = this.canvas.width / this.dpr, h = this.canvas.height / this.dpr; ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    this.camera.x += (s.player.x - this.camera.x) * 0.12; this.camera.y += (s.player.y - this.camera.y) * 0.12;
    ctx.save(); ctx.translate(w / 2 - this.camera.x, h / 2 - this.camera.y); drawWorld(ctx, s); ctx.restore();
  };
  function drawWorld(ctx, s) {
    ctx.fillStyle = C.zones.crash.color; ctx.fillRect(0, 0, C.world.width, C.world.height);
    ctx.fillStyle = C.zones.cold.color; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(C.world.width, 0); ctx.lineTo(C.world.width, 360); ctx.lineTo(C.world.baseX, C.world.baseY); ctx.lineTo(0, 360); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.zones.heat.color; ctx.beginPath(); ctx.moveTo(C.world.baseX, C.world.baseY); ctx.lineTo(C.world.width, 360); ctx.lineTo(C.world.width, C.world.height); ctx.lineTo(C.world.baseX, C.world.height); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.zones.gravity.color; ctx.beginPath(); ctx.moveTo(0, 360); ctx.lineTo(C.world.baseX, C.world.baseY); ctx.lineTo(C.world.baseX, C.world.height); ctx.lineTo(0, C.world.height); ctx.closePath(); ctx.fill();
    drawCircle(ctx, s.base.x, s.base.y, 420, C.zones.crash.color);
    ctx.strokeStyle = '#3e5052'; ctx.lineWidth = 3; ctx.strokeRect(0, 0, C.world.width, C.world.height);
    drawCircle(ctx, s.base.x, s.base.y, C.base.oxygenRadius, 'rgba(87,170,166,.08)', '#567b78'); drawCircle(ctx, s.base.x, s.base.y, C.base.radius, '#48615b', '#b4cbc2'); drawBaseStatus(ctx, s);
    s.nodes.forEach(function (n) { if (!R.pointInWorld(n) || n.amount <= 0 || (n.underground && !n.revealed)) return; if (n.underground) drawUndergroundNode(ctx, n); else drawCircle(ctx, n.x, n.y, 10, C.resources[n.type].color, '#1a2021'); });
    if (s.tool === 'harvester') { var harvestPoint = SA.app.renderer.worldPoint(SA.Input.state.mouse), harvestNodes = SA.World.harvestableNodes(s), harvestTarget = SA.World.harvestTarget(s, harvestPoint); drawCircle(ctx, s.player.x, s.player.y, C.runtime.harvestPlayerRange, 'rgba(255,255,255,.035)', '#ffffff'); harvestNodes.forEach(function (n) { if (R.distance(s.player, n) <= C.runtime.harvestPlayerRange) drawHarvesterHighlight(ctx, n); }); if (harvestTarget) drawHarvesterTarget(ctx, harvestTarget); }
    if (W.navigationVisible(s)) drawScannerRange(ctx, s);
    s.plants.forEach(function (p) { if (R.pointInWorld(p) && p.oxygen > 0) { ctx.strokeStyle = '#79c89f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p.x, p.y + 10); ctx.lineTo(p.x, p.y - 9); ctx.stroke(); drawCircle(ctx, p.x, p.y - 10, 7, '#8fcfa9'); } });
    s.caches.forEach(function (c) { if (R.pointInWorld(c) && !c.collected) { ctx.strokeStyle = '#d9c879'; ctx.strokeRect(c.x - 10, c.y - 8, 20, 16); } });
    var target = W.navigationVisible(s) ? targetById(s) : null; if (target) drawScanTarget(ctx, s, target);
    if (s.deathDrop && R.pointInWorld(s.deathDrop)) drawCircle(ctx, s.deathDrop.x, s.deathDrop.y, 13, '#c8c5b7', '#7d5d55');
    s.buildings.forEach(function (b) { if (R.pointInWorld(b)) drawBuilding(ctx, s, b); });
    s.enemies.forEach(function (e) { drawCircle(ctx, e.x, e.y, e.radius, e.variant === 0 ? '#a65d55' : e.variant === 1 ? '#8f4d63' : '#926c4c', '#d09a83'); if (e.hp < e.maxHp) { ctx.fillStyle = '#402828'; ctx.fillRect(e.x - 15, e.y - e.radius - 9, 30, 3); ctx.fillStyle = '#bc7168'; ctx.fillRect(e.x - 15, e.y - e.radius - 9, 30 * e.hp / e.maxHp, 3); } });
    ctx.fillStyle = '#d9d8cc'; s.bullets.forEach(function (b) { ctx.fillRect(b.x - 2, b.y - 2, 4, 4); });
    if (s.player.alive) { drawCircle(ctx, s.player.x, s.player.y, 12, s.player.invulnerable > 0 ? '#9db1ae' : '#d6d6cb', '#172023'); ctx.strokeStyle = '#9cc2c0'; ctx.beginPath(); ctx.moveTo(s.player.x, s.player.y); ctx.lineTo(s.player.x + 22, s.player.y); ctx.stroke(); }
    if (s.tool === 'build') { var m = SA.Input.state.mouse, point = SA.app.renderer.worldPoint(m), placement = SA.Buildings.validatePlacement(s, point), valid = placement.valid, buildingName = placement.def ? placement.def.label : '未知建筑', rangeText; if (valid && placement.def.range) drawBuildPreviewRange(ctx, point, placement.def); drawCircle(ctx, point.x, point.y, 17, valid ? 'rgba(120,220,150,.25)' : 'rgba(240,120,85,.25)', valid ? '#8fe0a5' : '#ff9b70'); ctx.fillStyle = valid ? '#c6f4d1' : '#ffd0b8'; ctx.font = '12px sans-serif'; rangeText = valid && placement.def.range ? ' · ' + (s.buildSelection === 'turret' ? '攻击' : '作用') + '范围 ' + placement.def.range + 'm' : ''; ctx.fillText(valid ? '准备建造：' + buildingName + rangeText + ' · 左键确认' : buildingName + '：' + placement.reason, point.x + 20, point.y - 18); if (valid && placement.warning) { ctx.fillStyle = '#ffc27c'; ctx.font = 'bold 11px sans-serif'; ctx.fillText('⚠ 熔岩侵蚀 · Lv' + s.adaptations.heat + '/Lv' + C.zones.heat.recommend + ' · -' + C.runtime.buildingHeatDamage.toFixed(2) + '/秒', point.x + 20, point.y - 2); } }
  }
  function drawBuilding(ctx, s, b) {
    var d = C.buildings[b.type], heatExposed = SA.Buildings.isHeatExposed(s, b);
    if (d.range && (b.type === 'o2_station' || b.type === 'slow_field' || b.type === 'shield_generator')) drawCircle(ctx, b.x, b.y, d.range, 'rgba(110,150,155,.04)', 'rgba(110,150,155,.18)');
    if (heatExposed) { ctx.save(); ctx.strokeStyle = 'rgba(255,151,76,' + (0.55 + Math.sin(s.time * 5) * 0.25) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, 24, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    if (b.type === 'signal_beacon') drawSignalBeacon(ctx, s, b);
    else { drawCircle(ctx, b.x, b.y, 16, d.color, '#151a1c'); if (b.type === 'turret') drawTurret(ctx, b); ctx.fillStyle = '#d9dfdc'; ctx.font = '11px sans-serif'; ctx.fillText(b.type === 'turret' ? 'T' + b.level : d.label.slice(0, 1), b.x - 5, b.y + 4); }
    if (b.hp < b.maxHp || heatExposed) { ctx.fillStyle = '#402828'; ctx.fillRect(b.x - 16, b.y - 27, 32, 4); ctx.fillStyle = '#bc7168'; ctx.fillRect(b.x - 16, b.y - 27, 32 * b.hp / b.maxHp, 4); }
    if (heatExposed) { ctx.fillStyle = '#ffc27c'; ctx.font = 'bold 10px sans-serif'; ctx.fillText('⚠ 侵蚀 ' + Math.max(0, Math.ceil(b.hp)) + '/' + b.maxHp, b.x - 28, b.y - 34); }
  }
  function drawBaseStatus(ctx, s) {
    var width = 92, height = 5, x = s.base.x - width / 2, y = s.base.y - C.base.radius - 30, hp = Math.max(0, Math.ceil(s.base.hp)), ratio = Math.max(0, Math.min(1, s.base.hp / C.base.hp)), shield = Math.max(0, Math.ceil(s.base.shield || 0));
    ctx.save();
    ctx.fillStyle = 'rgba(8,14,15,.82)'; ctx.fillRect(x - 5, y - 18, width + 10, shield ? 33 : 23);
    ctx.fillStyle = '#e2e8e3'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('基地 ' + hp + '/' + C.base.hp, s.base.x, y - 8);
    ctx.fillStyle = '#392d2b'; ctx.fillRect(x, y, width, height);
    ctx.fillStyle = ratio > .45 ? '#8fc9b8' : '#dd806f'; ctx.fillRect(x, y, width * ratio, height);
    if (shield) { ctx.fillStyle = '#243a4a'; ctx.fillRect(x, y + 10, width, 4); ctx.fillStyle = '#7bb6dc'; ctx.fillRect(x, y + 10, width * Math.min(1, shield / C.base.shieldPerGenerator), 4); ctx.fillStyle = '#9dcce7'; ctx.font = '10px sans-serif'; ctx.fillText('护盾 ' + shield, s.base.x, y + 25); }
    ctx.restore();
  }
  function drawSignalBeacon(ctx, s, b) {
    var pulse = 20 + Math.sin(s.time * 4) * 3;
    ctx.save();
    drawCircle(ctx, b.x, b.y, 16, C.buildings.signal_beacon.color, '#151a1c');
    ctx.strokeStyle = '#53676c'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(b.x, b.y + 9); ctx.lineTo(b.x, b.y - 10); ctx.stroke();
    drawCircle(ctx, b.x, b.y - 12, 3, '#edf5e6');
    ctx.strokeStyle = 'rgba(153, 220, 213, .82)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(b.x, b.y - 10, pulse, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(8,14,15,.88)'; ctx.fillRect(b.x - 35, b.y + 20, 70, 15); ctx.fillStyle = '#d9f1ed'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('信号台 · ' + s.signal.progress + '%', b.x, b.y + 31); ctx.textAlign = 'start'; ctx.restore();
  }
  function drawTurret(ctx, turret) {
    var angle = turret.aimAngle || 0, length = C.runtime.turretBarrelLength, x = turret.x + Math.cos(angle) * length, y = turret.y + Math.sin(angle) * length;
    ctx.save(); ctx.strokeStyle = '#30383a'; ctx.lineWidth = C.runtime.turretBarrelWidth; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(turret.x, turret.y); ctx.lineTo(x, y); ctx.stroke();
    if (turret.fireFlash > 0) { var flash = length + C.runtime.turretFireFlashLength * (turret.fireFlash / C.runtime.turretFireFlashDuration); ctx.strokeStyle = C.runtime.turretFireFlashColor; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(turret.x + Math.cos(angle) * flash, turret.y + Math.sin(angle) * flash); ctx.stroke(); }
    ctx.restore();
  }
  function drawBuildPreviewRange(ctx, point, def) {
    ctx.save(); ctx.strokeStyle = def === C.buildings.turret ? 'rgba(244,211,124,.86)' : 'rgba(116,200,194,.72)'; ctx.lineWidth = 1.5; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(point.x, point.y, def.range, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  }
  function drawUndergroundNode(ctx, node) {
    var size = 10;
    ctx.save(); ctx.fillStyle = C.resources[node.type].color; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.setLineDash([3, 2]); ctx.beginPath(); ctx.moveTo(node.x, node.y - size); ctx.lineTo(node.x + size, node.y); ctx.lineTo(node.x, node.y + size); ctx.lineTo(node.x - size, node.y); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(8,14,15,.88)'; ctx.fillRect(node.x - 14, node.y + 13, 28, 13); ctx.fillStyle = '#ffffff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('地下', node.x, node.y + 23); ctx.textAlign = 'start'; ctx.restore();
  }
  function targetById(s) { return s.scanActive ? SA.World.scanTarget(s) : null; }
  function drawScannerRange(ctx, s) { ctx.save(); ctx.strokeStyle = 'rgba(151,218,202,.75)'; ctx.lineWidth = 1.5; ctx.setLineDash([9, 7]); ctx.beginPath(); ctx.arc(s.player.x, s.player.y, SA.World.scanRange(s), 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
  function drawHarvesterHighlight(ctx, node) { ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(node.x, node.y, 16, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
  function drawHarvesterTarget(ctx, node) { ctx.save(); ctx.strokeStyle = '#f2d27c'; ctx.lineWidth = 3; ctx.setLineDash([]); ctx.beginPath(); ctx.arc(node.x, node.y, 21, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = '#f5e5b4'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(C.resources[node.type].label + ' · 左键采集', node.x + 24, node.y - 19); ctx.restore(); }
  function drawScanTarget(ctx, s, target) {
    var pulse = 18 + Math.sin(s.time * 5) * 5;
    ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.setLineDash([]); ctx.beginPath(); ctx.arc(target.x, target.y, pulse, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(s.player.x, s.player.y); ctx.lineTo(target.x, target.y); ctx.stroke();
    if (target.underground) { ctx.fillStyle = '#ffffff'; ctx.font = 'bold 13px sans-serif'; ctx.fillText('DIG', target.x - 13, target.y - pulse - 8); } ctx.restore();
  }
  function drawCircle(ctx, x, y, r, fill, stroke) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); } }
  SA.Renderer = Renderer;
}(window.StarAbyss = window.StarAbyss || {}));
