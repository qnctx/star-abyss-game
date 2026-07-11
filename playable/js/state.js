(function (SA) {
  'use strict';
  var C = SA.Config;
  function rng(state) { state.seed = (state.seed * 1664525 + 1013904223) >>> 0; return state.seed / 4294967296; }
  function id(state, prefix) { state.nextId += 1; return prefix + '_' + state.nextId; }
  function inventory() { var o = {}; Object.keys(C.resources).forEach(function (k) { o[k] = 0; }); return o; }
  function node(state, type, x, y, underground, amount) { return { id: id(state, 'node'), type: type, x: x, y: y, underground: !!underground, revealed: !underground, amount: amount || 3, depth: underground ? 2 + Math.floor(rng(state) * 8) : 0 }; }
  function create(seed) {
    var state = {
      schema: C.schema, seed: (seed || 73421) >>> 0, nextId: 0, mode: 'title', time: 0, day: 1, phaseTime: 0, isNight: false, forcedNight: false,
      player: { x: C.world.baseX, y: C.world.baseY + 80, hp: C.player.hp, oxygen: C.player.oxygen, alive: true, respawn: 0, invulnerable: 0 },
      base: { x: C.world.baseX, y: C.world.baseY, hp: C.base.hp, shield: 0 }, inventory: inventory(),
      adaptations: { crash: 0, cold: 0, heat: 0, gravity: 0 }, unlocked: { turret: true, o2_station: true, solar_panel: true, research_station: true, signal_beacon: true, shield_generator: false, slow_field: false },
      tool: 'weapon', buildSelection: 'turret', scanIndex: 0, scanActive: false, scanType: null, scanTarget: null, score: 0, kills: 0,
      nodes: [], plants: [], caches: [], buildings: [], enemies: [], bullets: [], deathDrop: null,
      signal: { progress: 0, timer: 0, milestones: {}, latest: '', log: [], extractionActive: false, extractionComplete: false, extractionRemaining: 0, evacuationSpawnCooldown: 0 },
      notices: [], firstDeathForgiven: false, savedAt: 0
    };
    seedWorld(state);
    state.inventory.oxygen_canister = 1;
    return state;
  }
  function seedWorld(s) {
    var types = ['iron', 'biomass', 'void_crystal', 'iron', 'biomass', 'energy_core'];
    var world = C.world;
    for (var i = 0; i < world.resourceSeedCount; i += 1) {
      var a = rng(s) * Math.PI * 2, radius = world.resourceMinRadius + rng(s) * world.resourceRadiusRange, t = types[Math.floor(rng(s) * types.length)];
      s.nodes.push(node(s, t, C.world.baseX + Math.cos(a) * radius, C.world.baseY + Math.sin(a) * radius, i % 4 === 0, t === 'energy_core' ? 1 : 2 + Math.floor(rng(s) * 4)));
    }
    for (var p = 0; p < world.plantSeedCount; p += 1) { var pa = rng(s) * Math.PI * 2, pr = world.plantMinRadius + rng(s) * world.plantRadiusRange; s.plants.push({ id: id(s, 'plant'), x: C.world.baseX + Math.cos(pa) * pr, y: C.world.baseY + Math.sin(pa) * pr, oxygen: 50 }); }
  }
  SA.State = { create: create, rng: rng, id: id, node: node };
}(window.StarAbyss = window.StarAbyss || {}));
