(function (SA) {
  'use strict';
  var resources = {
    iron: { label: '铁', weight: 0.5, color: '#c9b27c' },
    void_crystal: { label: '虚空晶体', weight: 0.3, color: '#a78bfa' },
    biomass: { label: '生物质', weight: 0.2, color: '#79b88a' },
    energy: { label: '能量', weight: 0.1, color: '#70b7d7' },
    energy_core: { label: '能量核心', weight: 1, color: '#f0c36b' },
    blueprint: { label: '蓝图', weight: 0.05, color: '#d7dde8' },
    oxygen_canister: { label: '氧气罐', weight: 1.5, color: '#7dd7d0' }
  };
  SA.Config = {
    schema: 3, saveKey: 'star_abyss_v3_slot', step: 1 / 60,
    world: { width: 2400, height: 1800, baseX: 1200, baseY: 900, day: 300, night: 150, visibleCap: 90, undergroundCap: 60, resourceSeedCount: 62, plantSeedCount: 12, resourceMinRadius: 220, resourceRadiusRange: 820, plantMinRadius: 280, plantRadiusRange: 680, dailyVisibleSpawn: 3, dailyUndergroundSpawn: 2, dailyResourceMinRadius: 500, dailyResourceRadiusRange: 500 },
    player: { speed: 180, sprint: 1.55, hp: 100, oxygen: 180, baseDrain: 0.32, capacity: 25, respawnOxygen: 90, invulnerability: 4, safeRecharge: 3, sprintOxygenMultiplier: 1.8 },
    base: { hp: 400, radius: 46, oxygenRadius: 105, shieldRecharge: 8, shieldPerGenerator: 65 },
    resources: resources,
    zones: {
      crash: { label: '坠毁区', pressure: 1, color: '#26343a', recommend: 0 },
      cold: { label: '极寒区', pressure: 3, color: '#203849', recommend: 2 },
      heat: { label: '熔岩区', pressure: 3.5, color: '#442c2a', recommend: 2 },
      gravity: { label: '重力异常区', pressure: 4, color: '#302943', recommend: 2 }
    },
    zoneEffects: [0, 0.2, 0.4, 0.7, 1],
    tools: [
      { id: 'weapon', key: '1', label: '武器' }, { id: 'harvester', key: '2', label: '采集器' },
      { id: 'scanner', key: '3', label: '扫描器' }, { id: 'build', key: '4', label: '建造' },
      { id: 'repair', key: '5', label: '维修' }
    ],
    scanTypes: ['iron', 'biomass', 'void_crystal', 'energy_core', 'oxygen_plant', 'blueprint', 'cache'],
    buildings: {
      turret: { label: '炮塔', cost: { iron: 20, void_crystal: 5 }, range: 280, hp: 100, color: '#b8a87d' },
      o2_station: { label: '氧气站', cost: { iron: 15, biomass: 10 }, range: 125, hp: 100, color: '#74c8c2' },
      shield_generator: { label: '护盾发生器', cost: { iron: 25, void_crystal: 8, energy_core: 1 }, range: 190, hp: 100, locked: true, color: '#7aa7d9' },
      solar_panel: { label: '太阳能板', cost: { iron: 18, biomass: 6 }, hp: 100, color: '#d0b96e' },
      research_station: { label: '研究站', cost: { iron: 20, void_crystal: 5, energy: 5 }, hp: 100, color: '#b5a6d8' },
      slow_field: { label: '减速场', cost: { iron: 15, biomass: 8, energy: 4 }, range: 180, hp: 100, locked: true, color: '#82a8a5' },
      signal_beacon: { label: '信号台', cost: { iron: 30, void_crystal: 10, energy: 10, blueprint: 2 }, hp: 100, color: '#d5d6c8' }
    },
    buildOrder: ['turret', 'o2_station', 'shield_generator', 'solar_panel', 'research_station', 'slow_field', 'signal_beacon'],
    unlocks: { shield_generator: { blueprint: 1 }, slow_field: { blueprint: 2 } },
    repair: { cost: { iron: 5, biomass: 2 }, amount: 35 },
    turretUpgrade: { cost: { iron: 10, energy: 5, blueprint: 1 }, max: 3 },
    serumRecipes: {
      crash: [{ iron: 10, biomass: 5 }, { iron: 25, biomass: 20 }, { void_crystal: 20, energy_core: 1, blueprint: 1 }, { void_crystal: 35, energy_core: 2, blueprint: 2 }],
      cold: [{ iron: 15, biomass: 10 }, { void_crystal: 10, biomass: 20 }, { void_crystal: 25, energy_core: 1, blueprint: 1 }, { void_crystal: 40, energy_core: 3, blueprint: 3 }],
      heat: [{ iron: 20, biomass: 15 }, { void_crystal: 12, biomass: 25 }, { void_crystal: 30, energy_core: 1, blueprint: 1 }, { void_crystal: 45, energy_core: 3, blueprint: 3 }],
      gravity: [{ iron: 25, void_crystal: 10 }, { void_crystal: 20, biomass: 15 }, { void_crystal: 35, energy_core: 2, blueprint: 1 }, { void_crystal: 50, energy_core: 3, blueprint: 3 }]
    },
    milestones: [
      { id: 'signal_25', at: 25, message: '无线电：坠毁盆地外检测到微弱自动信标。', x: 1530, y: 650, rewards: { iron: 12, energy: 3 } },
      { id: 'signal_50', at: 50, message: '无线电：晶洞中循环着破损的幸存者代码。', x: 760, y: 650, rewards: { void_crystal: 6, blueprint: 1 } },
      { id: 'signal_75', at: 75, message: '无线电：地下中继站返回了坠毁前坐标。', x: 1700, y: 1250, rewards: { biomass: 10, energy: 6 } },
      { id: 'signal_100', at: 100, message: '无线电：救援信号锁定。守住基地等待撤离。', x: 650, y: 1250, rewards: { energy_core: 1, blueprint: 2 } }
    ],
    signal: { interval: 12, energy: 1, progress: 5, extraction: 180, forcedNightWave: 10, forcedNightWavePerDay: 2, evacuationSpawnCooldown: 8, evacuationSpawnCount: 2, evacuationEnemyThreshold: 8 },
    runtime: { maxFrameDelta: 0.25, maxTestSteps: 360000, shotCooldown: 0.2, normalNightWaveCap: 22, normalNightWaveBase: 3, normalNightWavePerDay: 2, buildRange: 240, buildBaseClearance: 95, buildSpacing: 48, repairRange: 110, repairTargetRange: 45, recycleRange: 105, turretUpgradeRange: 110, buildingHeatDamage: 0.1, solarInterval: 18, researchInterval: 60, researchEnergy: 2, turretCooldownMin: 0.18, turretCooldown: 0.55, turretCooldownLevelReduction: 0.09, turretRangePerLevel: 35, turretDamage: 8, turretDamagePerLevel: 5, projectileSpeed: 480, projectileDamage: 14, projectileLife: 1.1, enemySpawnMinRadius: 560, enemySpawnRadiusRange: 300, enemyHpPerDay: 5, enemyHpPerVariant: 8, enemySpeedPerVariant: 7, enemyRadiusBase: 13, enemyRadiusPerVariant: 2, enemyAttackCooldown: 0.8, structureContactDamage: 10, playerContactInvulnerability: 0.45, slowMultiplier: 0.55, playerTargetRange: 135, structureTargetRange: 110, projectileHitRadius: 18, turretBarrelLength: 22, turretBarrelWidth: 5, turretFireFlashDuration: 0.09, turretFireFlashLength: 13, turretFireFlashColor: '#ffe49a', harvestTargetRange: 40, harvestPlayerRange: 105, cacheCollectRange: 32, deathDropCollectRange: 30, plantUseRange: 34, noticeDuration: 4, noticeLimit: 4 },
    enemy: { baseHp: 24, baseSpeed: 48, contactBase: 12, contactPlayer: 18, reward: { iron: 2, biomass: 1 } }
  };
}(window.StarAbyss = window.StarAbyss || {}));
