(function (SA) {
  'use strict';
  var C = SA.Config;
  function safeNumber(v, fallback, min, max) { return typeof v === 'number' && isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback; }
  function finite(v, min, max) { return typeof v === 'number' && isFinite(v) && v >= min && v <= max; }
  function text(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }
  function sanitize(raw) {
    if (!raw || raw.schema !== C.schema || typeof raw !== 'object') return null;
    var s = SA.State.create(safeNumber(raw.seed, 73421, 1, 4294967295));
    ['day', 'phaseTime', 'time', 'score', 'kills', 'nextId'].forEach(function (k) { s[k] = safeNumber(raw[k], s[k], 0, 1e9); });
    s.mode = ['playing', 'paused', 'victory', 'defeat'].indexOf(raw.mode) >= 0 ? raw.mode : 'playing'; s.isNight = !!raw.isNight; s.forcedNight = !!raw.forcedNight; s.firstDeathForgiven = !!raw.firstDeathForgiven;
    copyNumbers(s.player, raw.player, ['x', 'y', 'hp', 'oxygen', 'respawn', 'invulnerable']); s.player.alive = raw.player ? !!raw.player.alive : true;
    copyNumbers(s.base, raw.base, ['x', 'y', 'hp', 'shield']);
    Object.keys(s.inventory).forEach(function (k) { s.inventory[k] = Math.floor(safeNumber(raw.inventory && raw.inventory[k], 0, 0, 1e7)); });
    if (finite(raw.o2Kits, 0, 1e7)) s.inventory.oxygen_canister = Math.min(1e7, s.inventory.oxygen_canister + Math.floor(raw.o2Kits));
    Object.keys(s.adaptations).forEach(function (k) { s.adaptations[k] = Math.floor(safeNumber(raw.adaptations && raw.adaptations[k], 0, 0, 4)); });
    Object.keys(s.unlocked).forEach(function (k) { s.unlocked[k] = raw.unlocked && typeof raw.unlocked[k] === 'boolean' ? raw.unlocked[k] : s.unlocked[k]; });
    s.nodes = sanitizeArray(raw.nodes, node, 500); s.plants = sanitizeArray(raw.plants, plant, 100); s.caches = sanitizeArray(raw.caches, cache, 20); s.buildings = sanitizeArray(raw.buildings, building, 200); s.enemies = sanitizeArray(raw.enemies, enemy, 500); s.bullets = sanitizeArray(raw.bullets, bullet, 500);
    if (raw.deathDrop && finite(raw.deathDrop.x, -1e7, 1e7) && finite(raw.deathDrop.y, -1e7, 1e7) && validItems(raw.deathDrop.items)) s.deathDrop = { x: raw.deathDrop.x, y: raw.deathDrop.y, items: items(raw.deathDrop.items) };
    sanitizeSignal(s, raw.signal);
    s.tool = C.tools.some(function (t) { return t.id === raw.tool; }) ? raw.tool : 'weapon';
    s.buildSelection = C.buildings[raw.buildSelection] ? raw.buildSelection : 'turret';
    s.scanIndex = Math.floor(safeNumber(raw.scanIndex, 0, 0, C.scanTypes.length - 1));
    s.scanTarget = typeof raw.scanTarget === 'string' ? raw.scanTarget.slice(0, 80) : null;
    var hasValidScanTarget = !!SA.World.scanTarget(s);
    if (raw.scanActive === false) { s.scanActive = false; s.scanType = null; s.scanTarget = null; }
    else if (raw.scanActive === true) { s.scanActive = true; s.scanType = C.scanTypes.indexOf(raw.scanType) >= 0 ? raw.scanType : C.scanTypes[s.scanIndex]; if (!hasValidScanTarget) s.scanTarget = null; }
    else if (hasValidScanTarget) { s.scanActive = true; s.scanType = C.scanTypes.indexOf(raw.scanType) >= 0 ? raw.scanType : C.scanTypes[s.scanIndex]; }
    else { s.scanActive = false; s.scanType = null; s.scanTarget = null; }
    s.notices = [];
    return s;
  }
  function sanitizeArray(value, mapper, limit) { if (!Array.isArray(value)) return []; var result = []; value.slice(0, limit).forEach(function (x) { var clean = mapper(x); if (clean) result.push(clean); }); return result; }
  function point(x) { return x && typeof x === 'object' && finite(x.x, -1e7, 1e7) && finite(x.y, -1e7, 1e7); }
  function node(x) { if (!point(x) || !C.resources[x.type] || !finite(x.amount, 0, 1e7)) return null; return { id: text(x.id, 80), type: x.type, x: x.x, y: x.y, underground: !!x.underground, revealed: !!x.revealed, amount: Math.floor(x.amount), depth: safeNumber(x.depth, 0, 0, 1e4) }; }
  function plant(x) { return point(x) && finite(x.oxygen, 0, C.player.oxygen) ? { id: text(x.id, 80), x: x.x, y: x.y, oxygen: x.oxygen } : null; }
  function cache(x) { return point(x) && validItems(x.rewards) ? { id: text(x.id, 80), x: x.x, y: x.y, rewards: items(x.rewards), collected: !!x.collected } : null; }
  function building(x) { var d = x && C.buildings[x.type]; if (!d || !point(x) || !finite(x.hp, 0, d.hp) || !finite(x.maxHp, 1, d.hp) || !finite(x.timer, -10, 1e7)) return null; return { id: text(x.id, 80), type: x.type, x: x.x, y: x.y, hp: x.hp, maxHp: x.maxHp, level: Math.floor(safeNumber(x.level, 0, 0, C.turretUpgrade.max)), timer: x.timer, aimAngle: safeNumber(x.aimAngle, 0, -Math.PI * 2, Math.PI * 2), fireFlash: safeNumber(x.fireFlash, 0, 0, C.runtime.turretFireFlashDuration) }; }
  function enemy(x) { if (!point(x) || !finite(x.hp, 0, 1e7) || !finite(x.maxHp, 1, 1e7) || !finite(x.speed, 0, 1e4) || !finite(x.radius, 1, 100)) return null; return { id: text(x.id, 80), x: x.x, y: x.y, hp: x.hp, maxHp: x.maxHp, speed: x.speed, radius: x.radius, attack: safeNumber(x.attack, 0, -10, 1e4), variant: Math.floor(safeNumber(x.variant, 0, 0, 2)), rewarded: !!x.rewarded, dead: !!x.dead }; }
  function bullet(x) { if (!point(x) || !finite(x.vx, -1e5, 1e5) || !finite(x.vy, -1e5, 1e5) || !finite(x.damage, 0, 1e5) || !finite(x.life, 0, 100)) return null; return { x: x.x, y: x.y, vx: x.vx, vy: x.vy, damage: x.damage, life: x.life, cause: x.cause === 'turret' ? 'turret' : 'player' }; }
  function validItems(value) { return value && typeof value === 'object' && Object.keys(value).every(function (k) { return C.resources[k] && finite(value[k], 0, 1e7); }); }
  function items(value) { var out = {}; Object.keys(value).forEach(function (k) { if (C.resources[k]) out[k] = Math.floor(value[k]); }); return out; }
  function sanitizeSignal(s, raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    s.signal.progress = safeNumber(raw.progress, 0, 0, 100); s.signal.timer = safeNumber(raw.timer, 0, 0, C.signal.interval); s.signal.latest = text(raw.latest, 300); s.signal.evacuationSpawnCooldown = safeNumber(raw.evacuationSpawnCooldown, 0, 0, C.signal.evacuationSpawnCooldown);
    s.signal.log = Array.isArray(raw.log) ? raw.log.filter(function (x) { return typeof x === 'string'; }).slice(-20).map(function (x) { return x.slice(0, 300); }) : [];
    s.signal.milestones = {}; C.milestones.forEach(function (m) { if (s.signal.progress >= m.at) { s.signal.milestones[m.id] = true; if (s.signal.log.indexOf(m.message) < 0) s.signal.log.push(m.message); if (!s.caches.some(function (c) { return c.id === m.id; })) s.caches.push({ id: m.id, x: m.x, y: m.y, rewards: JSON.parse(JSON.stringify(m.rewards)), collected: false }); } });
    s.signal.extractionComplete = !!raw.extractionComplete || s.mode === 'victory'; s.signal.extractionActive = s.signal.progress === 100 && !s.signal.extractionComplete && !!raw.extractionActive; s.signal.extractionRemaining = safeNumber(raw.extractionRemaining, C.signal.extraction, 0, C.signal.extraction);
    if (s.signal.progress === 100 && !s.signal.extractionComplete && !s.signal.extractionActive) { s.signal.extractionActive = true; s.signal.extractionRemaining = C.signal.extraction; }
    if (s.signal.extractionActive) { s.forcedNight = true; s.isNight = true; if (s.signal.extractionRemaining === 0) s.signal.extractionRemaining = 0.1; }
    if (s.signal.progress < 100) { s.signal.extractionActive = false; s.signal.extractionComplete = false; s.signal.extractionRemaining = 0; s.signal.evacuationSpawnCooldown = 0; s.forcedNight = false; }
  }
  function copyNumbers(to, from, keys) { if (!from || typeof from !== 'object') return; keys.forEach(function (k) { to[k] = safeNumber(from[k], to[k], -1e7, 1e7); }); }
  function save(s) { try { s.savedAt = Date.now(); localStorage.setItem(C.saveKey, JSON.stringify(s)); return true; } catch (e) { return false; } }
  function load() { try { var value = localStorage.getItem(C.saveKey); return value ? sanitize(JSON.parse(value)) : null; } catch (e) { return null; } }
  function exists() { try { return !!localStorage.getItem(C.saveKey); } catch (e) { return false; } }
  function remove() { try { localStorage.removeItem(C.saveKey); } catch (e) {} }
  SA.Save = { sanitize: sanitize, save: save, load: load, exists: exists, remove: remove };
}(window.StarAbyss = window.StarAbyss || {}));
