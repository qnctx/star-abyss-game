(function (SA) {
  'use strict';
  var C = SA.Config, R = SA.Rules, W = SA.World;
  function spawn(s, count) {
    var runtime = C.runtime;
    for (var i = 0; i < count; i += 1) { var a = SA.State.rng(s) * Math.PI * 2, r = runtime.enemySpawnMinRadius + SA.State.rng(s) * runtime.enemySpawnRadiusRange, variant = (s.day + i) % 3, hp = C.enemy.baseHp + s.day * runtime.enemyHpPerDay + variant * runtime.enemyHpPerVariant; s.enemies.push({ id: SA.State.id(s, 'enemy'), x: s.base.x + Math.cos(a) * r, y: s.base.y + Math.sin(a) * r, hp: hp, maxHp: hp, speed: C.enemy.baseSpeed + variant * runtime.enemySpeedPerVariant, radius: runtime.enemyRadiusBase + variant * runtime.enemyRadiusPerVariant, attack: 0, variant: variant, rewarded: false }); }
  }
  function shoot(s, point) { var a = Math.atan2(point.y - s.player.y, point.x - s.player.x); s.bullets.push({ x: s.player.x, y: s.player.y, vx: Math.cos(a) * C.runtime.projectileSpeed, vy: Math.sin(a) * C.runtime.projectileSpeed, damage: C.runtime.projectileDamage, life: C.runtime.projectileLife, cause: 'player' }); }
  function damageEnemy(s, enemy, amount, cause) { enemy.hp -= amount; if (enemy.hp <= 0) kill(s, enemy, cause); }
  function kill(s, enemy, cause) {
    var eligible = cause === 'player' || cause === 'turret';
    if (eligible && !enemy.rewarded) {
      enemy.rewarded = true;
      R.add(s.inventory, C.enemy.reward);
      s.kills += 1;
      s.score += 50;
      W.notice(s, (cause === 'player' ? '武器' : '炮塔') + '击杀：+' + R.costText(C.enemy.reward));
    }
    enemy.dead = true;
  }
  function tick(s, dt) {
    s.buildings.filter(function (b) { return b.type === 'turret' && b.hp > 0; }).forEach(function (t) { t.timer = Math.max(0, t.timer - dt); t.fireFlash = Math.max(0, (t.fireFlash || 0) - dt); var target = nearestEnemy(s, t, C.buildings.turret.range + t.level * C.runtime.turretRangePerLevel); if (target && t.timer <= 0) { t.aimAngle = Math.atan2(target.y - t.y, target.x - t.x); t.fireFlash = C.runtime.turretFireFlashDuration; damageEnemy(s, target, C.runtime.turretDamage + t.level * C.runtime.turretDamagePerLevel, 'turret'); t.timer = Math.max(C.runtime.turretCooldownMin, C.runtime.turretCooldown - t.level * C.runtime.turretCooldownLevelReduction); } });
    s.bullets.forEach(function (b) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; var hit = W.nearestAt(s.enemies.filter(function (e) { return !e.dead; }), b, C.runtime.projectileHitRadius); if (hit) { damageEnemy(s, hit, b.damage, b.cause); b.life = 0; } });
    s.bullets = s.bullets.filter(function (b) { return b.life > 0; });
    s.enemies.forEach(function (e) {
      if (e.dead) return; var slow = s.buildings.some(function (b) { return b.hp > 0 && b.type === 'slow_field' && R.distance(b, e) < C.buildings.slow_field.range; }) ? C.runtime.slowMultiplier : 1;
      var target = chooseTarget(s, e), a = Math.atan2(target.y - e.y, target.x - e.x); e.x += Math.cos(a) * e.speed * slow * dt; e.y += Math.sin(a) * e.speed * slow * dt; e.attack -= dt;
      if (R.distance(e, target) < (target === s.base ? C.base.radius : 24) && e.attack <= 0) {
        e.attack = C.runtime.enemyAttackCooldown;
        if (target === s.player) {
          if (s.player.invulnerable <= 0) { s.player.hp -= C.enemy.contactPlayer; s.player.invulnerable = C.runtime.playerContactInvulnerability; if (s.player.hp <= 0) R.die(s); }
        } else if (target === s.base) {
          damageBase(s, C.enemy.contactBase);
          if (!e.warnedBaseAttack) { e.warnedBaseAttack = true; W.notice(s, '敌人正在攻击基地：基地 -' + C.enemy.contactBase + '。'); }
        } else {
          target.lastDamageCause = '敌袭';
          target.hp -= C.runtime.structureContactDamage;
          if (!e.warnedStructureAttack) { e.warnedStructureAttack = true; W.notice(s, '敌人正在攻击' + C.buildings[target.type].label + '：耐久 -' + C.runtime.structureContactDamage + '。'); }
        }
      }
    });
    s.enemies = s.enemies.filter(function (e) { return !e.dead; });
  }
  function chooseTarget(s, e) { if (s.player.alive && R.distance(e, s.player) < C.runtime.playerTargetRange) return s.player; var b = W.nearestAt(s.buildings.filter(function (building) { return building.hp > 0; }), e, C.runtime.structureTargetRange); return b || s.base; }
  function nearestEnemy(s, from, radius) { return W.nearestAt(s.enemies.filter(function (e) { return !e.dead; }), from, radius); }
  function damageBase(s, amount) { if (s.base.shield > 0) { var used = Math.min(s.base.shield, amount); s.base.shield -= used; amount -= used; } s.base.hp -= amount; if (s.base.hp <= 0) { s.base.hp = 0; s.mode = 'defeat'; } }
  SA.Combat = { spawn: spawn, shoot: shoot, tick: tick, damageEnemy: damageEnemy, kill: kill, damageBase: damageBase };
}(window.StarAbyss = window.StarAbyss || {}));
