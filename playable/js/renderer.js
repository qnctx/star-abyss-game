(function (SA) {
  'use strict';
  var C = SA.Config, R = SA.Rules;
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
    drawCircle(ctx, s.base.x, s.base.y, C.base.oxygenRadius, 'rgba(87,170,166,.08)', '#567b78'); drawCircle(ctx, s.base.x, s.base.y, C.base.radius, '#48615b', '#b4cbc2');
    s.nodes.forEach(function (n) { if (n.amount <= 0 || (n.underground && !n.revealed)) return; drawCircle(ctx, n.x, n.y, n.underground ? 7 : 10, C.resources[n.type].color, n.underground ? '#fff' : '#1a2021'); });
    if (s.tool === 'harvester') { drawCircle(ctx, s.player.x, s.player.y, C.runtime.harvestPlayerRange, 'rgba(255,255,255,.035)', '#ffffff'); s.nodes.forEach(function (n) { if (n.amount > 0 && (!n.underground || n.revealed) && R.distance(s.player, n) <= C.runtime.harvestPlayerRange) drawHarvesterHighlight(ctx, n); }); }
    s.plants.forEach(function (p) { if (p.oxygen > 0) { ctx.strokeStyle = '#79c89f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p.x, p.y + 10); ctx.lineTo(p.x, p.y - 9); ctx.stroke(); drawCircle(ctx, p.x, p.y - 10, 7, '#8fcfa9'); } });
    s.caches.forEach(function (c) { if (!c.collected) { ctx.strokeStyle = '#d9c879'; ctx.strokeRect(c.x - 10, c.y - 8, 20, 16); } });
    var target = targetById(s); if (target) drawScanTarget(ctx, s, target);
    if (s.deathDrop) drawCircle(ctx, s.deathDrop.x, s.deathDrop.y, 13, '#c8c5b7', '#7d5d55');
    s.buildings.forEach(function (b) { drawBuilding(ctx, b); });
    s.enemies.forEach(function (e) { drawCircle(ctx, e.x, e.y, e.radius, e.variant === 0 ? '#a65d55' : e.variant === 1 ? '#8f4d63' : '#926c4c', '#d09a83'); if (e.hp < e.maxHp) { ctx.fillStyle = '#402828'; ctx.fillRect(e.x - 15, e.y - e.radius - 9, 30, 3); ctx.fillStyle = '#bc7168'; ctx.fillRect(e.x - 15, e.y - e.radius - 9, 30 * e.hp / e.maxHp, 3); } });
    ctx.fillStyle = '#d9d8cc'; s.bullets.forEach(function (b) { ctx.fillRect(b.x - 2, b.y - 2, 4, 4); });
    if (s.player.alive) { drawCircle(ctx, s.player.x, s.player.y, 12, s.player.invulnerable > 0 ? '#9db1ae' : '#d6d6cb', '#172023'); ctx.strokeStyle = '#9cc2c0'; ctx.beginPath(); ctx.moveTo(s.player.x, s.player.y); ctx.lineTo(s.player.x + 22, s.player.y); ctx.stroke(); }
    if (s.tool === 'build') { var m = SA.Input.state.mouse, point = SA.app.renderer.worldPoint(m), placement = SA.Buildings.validatePlacement(s, point), valid = placement.valid; drawCircle(ctx, point.x, point.y, 17, valid ? 'rgba(120,220,150,.25)' : 'rgba(240,120,85,.25)', valid ? '#8fe0a5' : '#ff9b70'); ctx.fillStyle = valid ? '#c6f4d1' : '#ffd0b8'; ctx.font = '12px sans-serif'; ctx.fillText(valid ? '可建造' : placement.reason, point.x + 20, point.y - 18); }
  }
  function drawBuilding(ctx, b) {
    var d = C.buildings[b.type];
    if (d.range && (b.type === 'o2_station' || b.type === 'slow_field' || b.type === 'shield_generator')) drawCircle(ctx, b.x, b.y, d.range, 'rgba(110,150,155,.04)', 'rgba(110,150,155,.18)');
    drawCircle(ctx, b.x, b.y, 16, d.color, '#151a1c');
    if (b.type === 'turret') drawTurret(ctx, b);
    ctx.fillStyle = '#d9dfdc'; ctx.font = '11px sans-serif'; ctx.fillText(b.type === 'turret' ? 'T' + b.level : d.label.slice(0, 1), b.x - 5, b.y + 4);
  }
  function drawTurret(ctx, turret) {
    var angle = turret.aimAngle || 0, length = C.runtime.turretBarrelLength, x = turret.x + Math.cos(angle) * length, y = turret.y + Math.sin(angle) * length;
    ctx.save(); ctx.strokeStyle = '#30383a'; ctx.lineWidth = C.runtime.turretBarrelWidth; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(turret.x, turret.y); ctx.lineTo(x, y); ctx.stroke();
    if (turret.fireFlash > 0) { var flash = length + C.runtime.turretFireFlashLength * (turret.fireFlash / C.runtime.turretFireFlashDuration); ctx.strokeStyle = C.runtime.turretFireFlashColor; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(turret.x + Math.cos(angle) * flash, turret.y + Math.sin(angle) * flash); ctx.stroke(); }
    ctx.restore();
  }
  function targetById(s) { return s.scanActive ? SA.World.scanTarget(s) : null; }
  function drawHarvesterHighlight(ctx, node) { ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(node.x, node.y, 16, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
  function drawScanTarget(ctx, s, target) {
    var pulse = 18 + Math.sin(s.time * 5) * 5;
    ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.setLineDash([]); ctx.beginPath(); ctx.arc(target.x, target.y, pulse, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(s.player.x, s.player.y); ctx.lineTo(target.x, target.y); ctx.stroke();
    if (target.underground) { ctx.fillStyle = '#ffffff'; ctx.font = 'bold 13px sans-serif'; ctx.fillText('DIG', target.x - 13, target.y - pulse - 8); } ctx.restore();
  }
  function drawCircle(ctx, x, y, r, fill, stroke) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); } }
  SA.Renderer = Renderer;
}(window.StarAbyss = window.StarAbyss || {}));
