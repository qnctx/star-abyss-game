(function (SA) {
  'use strict';
  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function zoneAt(x, y) {
    var dx = x - SA.Config.world.baseX, dy = y - SA.Config.world.baseY;
    if (Math.hypot(dx, dy) < 420) return 'crash';
    if (dy < -Math.abs(dx) * 0.45) return 'cold';
    if (dx > 0) return 'heat';
    return 'gravity';
  }
  function weight(inv) { return Object.keys(inv).reduce(function (sum, k) { return sum + (SA.Config.resources[k] ? SA.Config.resources[k].weight : 0) * inv[k]; }, 0); }
  function weightSpeed(inv) { var r = weight(inv) / SA.Config.player.capacity; return r <= 1 ? 1 : Math.max(0.5, 1 - (r - 1) * 0.5); }
  function weightOxygen(inv) { var r = weight(inv) / SA.Config.player.capacity; return r <= 1 ? 1 : Math.min(1.5, 1 + (r - 1) * 0.5); }
  function zoneOxygen(state, zone) { var level = state.adaptations[zone] || 0, pressure = SA.Config.zones[zone].pressure; var result = pressure * (1 - SA.Config.zoneEffects[level] * 0.9); if (zone === 'crash' && level === 4) result *= 0.7; return Math.max(0.3, result); }
  function zoneSpeed(state, zone) { return zone === 'gravity' && state.adaptations[zone] < 2 ? 0.7 : 1; }
  function has(inv, cost) { return Object.keys(cost).every(function (k) { return (inv[k] || 0) >= cost[k]; }); }
  function consume(inv, cost) { if (!has(inv, cost)) return false; Object.keys(cost).forEach(function (k) { inv[k] -= cost[k]; }); return true; }
  function add(inv, items) { Object.keys(items).forEach(function (k) { inv[k] = (inv[k] || 0) + items[k]; }); }
  function dropHalf(state) {
    var dropped = {}; Object.keys(state.inventory).forEach(function (k) { var n = Math.floor(state.inventory[k] / 2); if (n) { dropped[k] = n; state.inventory[k] -= n; } });
    if (!Object.keys(dropped).length) return;
    if (state.deathDrop) add(state.deathDrop.items, dropped); else state.deathDrop = { x: state.player.x, y: state.player.y, items: dropped };
  }
  function die(state) {
    if (!state.player.alive) return;
    if (!(state.day === 1 && !state.firstDeathForgiven)) dropHalf(state); else state.firstDeathForgiven = true;
    state.player.alive = false; state.player.respawn = 3; state.player.hp = 0;
  }
  function respawn(state) { state.player.alive = true; state.player.x = state.base.x; state.player.y = state.base.y + 70; state.player.hp = SA.Config.player.hp; state.player.oxygen = SA.Config.player.respawnOxygen; state.player.invulnerable = SA.Config.player.invulnerability; }
  function costText(cost) { return Object.keys(cost).map(function (k) { return cost[k] + ' ' + (SA.Config.resources[k] ? SA.Config.resources[k].label : k); }).join(' / '); }
  SA.Rules = { distance: distance, clamp: clamp, zoneAt: zoneAt, weight: weight, weightSpeed: weightSpeed, weightOxygen: weightOxygen, zoneOxygen: zoneOxygen, zoneSpeed: zoneSpeed, has: has, consume: consume, add: add, dropHalf: dropHalf, die: die, respawn: respawn, costText: costText };
}(window.StarAbyss = window.StarAbyss || {}));
