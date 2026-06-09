# 🪐 星渊迷航 — 开发进度看板

> 最后更新：2026-05-20  
> 仓库：https://github.com/qnctx/star-abyss-game  
> 本地：~/projects/star-abyss-game/src/

---

## 📊 当前进度总览

| Phase | 目标 | 状态 | 文件数 |
|-------|------|------|--------|
| **Sprint 0** | 核心原型 | ✅ 完成 | 44 |
| Sprint 1 | 建造 + 科技树 | ⬜ 待开始 | - |
| Sprint 2 | 随机地图 | ⬜ 待开始 | - |
| Sprint 3 | 发布 Steam | ⬜ 待开始 | - |

---

## ✅ 已完成系统

| 系统 | 详情 |
|------|------|
| 🎮 角色控制 | WASD + Shift，宇航员低模 |
| 💨 O₂ 系统 | 氧气条 + 消耗 + 死亡/重生 |
| 👾 敌人 AI | 外星虫子朝基地冲，波次递增 |
| 🔫 炮台 | 自动索敌 + 科幻炮塔 |
| 🔫 **玩家武器** | 5 种（手枪/霰弹枪/步枪/火焰/冰冻），鼠标瞄准射击 |
| ⭐ **品质系统** | 5 级（普通→精良→稀有→史诗→传说），伤害倍率 1.0→2.5x |
| 🪨 **资源采集** | 铁/虚空晶/生物质/能量核心/蓝图，每天刷新 |
| ⚒️ **锻造台** | E 键打开，升级品质/解锁武器，材料配方 |
| 🌙 昼夜循环 | 2 分白天 / 1 分夜晚 |
| ✨ 特效 | 枪火、爆炸、漂浮孢子 |
| 🎨 美术 | 低模 CSG，宇航员/虫子/炮塔/逃生舱 |

---

## 💰 费用

| 轮次 | 内容 | 花费 |
|------|------|------|
| Sprint 0 | 项目搭建 + 角色 + O₂ | $0.58 |
| Sprint 0.5 | 敌人 + 炮台 + 昼夜 | $0.64 |
| Sprint 0.6 | 视觉美化 | ~$1.50 |
| Sprint 1 | 武器 + 资源 + 锻造台 | ~$2.00 |
| **合计** | | **~$4.72** |

---

## 🖥️ 你在 Windows 上试玩

```powershell
# 1. 装 Godot 4.6.2 标准版
#    https://godotengine.org/download/windows/

# 2. 克隆项目
git clone https://github.com/qnctx/star-abyss-game.git
cd star-abyss-game/src

# 3. 打开项目
#    用 Godot 打开 project.godot

# 4. 按 F5 试玩
#    WASD 移动, Shift 冲刺
#    白天探索，夜晚敌人来袭
#    炮台自动防守
```

---

## 📸 预期画面

```
俯视视角，紫色毒气笼罩的外星地表
你 = 白色宇航员
基地 = 倾斜的逃生舱（橙色灯光闪烁）
炮台 = 金属科幻炮塔（枪口发光）
敌人 = 红眼六足虫子（从四面八方冲来）
弹丸 = 黄色能量弹（旋转拖尾）
夜晚 = 一波波虫子越来越多
```
---

## 2026-06-09 - Signal Cache Exploration Slice

- Added `SignalCache`, a collectible radio-led exploration reward:
  - Spawned by `SignalLogManager` when signal milestones unlock.
  - Each milestone has a deterministic cache position and resource bundle.
  - Player collision collects the cache and grants resources.
  - Collected caches are recorded so they do not respawn after save/load.
- Expanded `SignalLogManager`:
  - Tracks `collected_caches`.
  - Spawns uncollected caches for unlocked radio logs.
  - Provides nearest active cache direction/distance via `get_cache_hint()`.
- Expanded Combat HUD:
  - Latest Radio log row now also shows nearest Signal Cache hint while a cache is active.
- Expanded Objective Tracker:
  - During safe daytime states, active Signal Caches are surfaced as `Locate signal cache` objectives.
- Added automated coverage for cache spawning, collection rewards, collected-state tracking, HUD cache hints, and objective cache guidance.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 247 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- CodeGraph status: `[OK] Index is up to date`; current GDScript project still indexes 0 files.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Signal Radio Log Slice

- Added `SignalLogManager` as a new autoload:
  - Tracks unlocked signal radio logs.
  - Unlocks logs at `25`, `50`, `75`, and `100` Signal Beacon progress.
  - Stores the latest visible radio message.
- Signal Beacon now registers progress with `SignalLogManager` whenever energy advances the signal.
- Combat HUD now shows the latest Radio log under the signal/save rows.
- SaveManager now persists:
  - Signal radio log unlock state.
  - Latest radio message.
  - It can also rebuild missing log milestones from restored Signal Beacon progress for older save data.
- Added automated coverage for log milestones, latest message, save/restore, Signal Beacon-triggered unlocks, and HUD Radio display.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 237 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- CodeGraph status: `[OK] Index is up to date`; current GDScript project still indexes 0 files.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Signal Beacon Slice

- Added `SignalBeacon`, a buildable long-term rescue-signal structure:
  - Build mode key: `7`.
  - Cost: `30 iron + 10 void_crystal + 10 energy + 2 blueprint`.
  - Every `6s`, consumes `1 energy` and adds `10/100` signal progress.
  - Pauses when energy is unavailable.
  - Shows completion text at `100/100`.
- Expanded `BuildManager` and `TechManager`:
  - Signal Beacon is unlocked by default after the research/blueprint economy exists.
  - Build HUD now includes `7Sig`.
- Expanded Combat HUD:
  - Shows the strongest Signal Beacon status as a dedicated `Signal:` row.
- Expanded Objective Tracker:
  - After the current defense/upgrade chain, it guides the player to build and power the Signal Beacon.
- Expanded SaveManager:
  - Saves and restores Signal Beacon progress and power timer.
- Added automated coverage for build option/cost, energy consumption, progress pause/completion, HUD status, default tech unlock, and save/load restoration.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 223 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- CodeGraph status: `[OK] Index is up to date`; current GDScript project still indexes 0 files.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Save HUD Feedback Slice

- Connected `SaveManager.save_status_changed(message)` into the Combat HUD.
- Added a short-lived top-left save status row:
  - `Save: Saved`
  - `Save: Loaded`
  - failure/no-file messages such as `Save: No save file`
- The status clears automatically after `2.5` seconds so it does not crowd the combat/objective HUD.
- Added automated coverage for showing and clearing the HUD save status.
- Updated GDD, context docs, progress, and the manual save/load checklist.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 202 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- CodeGraph status: `[OK] Index is up to date`; current GDScript project still indexes 0 files.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Save Active Enemies Slice

- Expanded SaveManager beyond the first save/load MVP:
  - Active enemies are now included in save data.
  - Persisted enemy data includes position, scale, name, health, speed, damage, attack settings, and wave variant metadata.
  - Loading restores enemy nodes from `enemy.tscn`.
  - Restored enemies reconnect to `GameManager._on_enemy_died` and `_on_base_reached`.
  - `GameManager.enemies_alive` is restored from the number of active enemies loaded.
- Updated manual save/load test steps to cover saving during night while enemies are alive.
- Updated GDD and context docs to remove the previous active-enemy persistence limitation.
- Added automated coverage for enemy capture, restore, enemy count, health, and variant label.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 199 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- CodeGraph status: `[OK] Index is up to date`; current GDScript project still indexes 0 files.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Save Load MVP Slice

- Added `SaveManager` autoload with runtime quick-save/load:
  - `F6` quick-save.
  - `F7` quick-load.
  - Save file path: `user://star_abyss_save.json`.
- MVP persisted state:
  - Inventory resources.
  - Tech unlocks.
  - Base HP, shield, wave number, phase timer, day/night flag, wave direction.
  - Built structures with build id, position, scale, build cost/label, HP, max HP, upgrade level, turret damage/fire rate.
- BuildManager now tags newly placed structures with `build_id` metadata so save/load can restore the right structure type.
- Combat HUD main hint now includes `F6 Save F7 Load`.
- Load behavior:
  - Clears current enemies and built structures before restoring saved state.
  - Active enemies are not persisted yet; this MVP is safest during daytime or between waves.
- Added automated coverage for save capture and apply/restore across inventory, tech, base state, and built turret state.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 193 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- CodeGraph status: `[OK] Index is up to date`; current GDScript project still indexes 0 files.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Structure Damage Guidance Slice

- Added damaged-structure visibility to the Combat HUD:
  - Base HUD row now shows a compact damaged-structure summary.
  - Single damaged structure example: `Struct Turret 40/100 | B+R READY`.
  - Multiple damaged structures show count plus worst HP.
  - Repair readiness uses the existing `5 iron + 2 biomass` repair cost.
- Objective Tracker now prioritizes damaged structure repair during daytime after base repair:
  - If funded, it asks the player to repair damaged structures with `B, R`.
  - If unfunded, it asks for the missing repair resources.
- Added automated coverage for HUD damaged-structure text and objective repair priority/resource guidance.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 174 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- CodeGraph status: `[OK] Index is up to date`; current GDScript project still indexes 0 files.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Enemy Structure Targeting Slice

- Expanded enemy behavior beyond only walking to the base:
  - Enemies now scan for nearby `built_structures`.
  - If a structure is within `structure_target_range`, the enemy moves to it.
  - Inside `attack_range`, the enemy stops and attacks on `structure_attack_interval`.
- Structure attacks use the existing structure HP metadata:
  - `structure_health`
  - `structure_max_health`
  - Structures at 0 HP are queued for deletion.
- This makes defensive placement, repair, and accidental walling more meaningful:
  - Structures can buy time.
  - Enemies no longer just press against nearby built modules forever.
  - Repair mode can recover damaged structures after attacks.
- Added automated coverage for target selection, attack cooldown, repeated structure damage, structure destruction, and ignoring non-built nodes.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 168 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- CodeGraph status: `[OK] Index is up to date`; current GDScript project still indexes 0 files.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Tech Unlock Gate Slice

- Added `TechManager` as a small blueprint-driven technology autoload.
- Default unlocked buildings:
  - Turret.
  - O2 Station.
  - Solar Panel.
  - Research Station.
- Default locked buildings:
  - Shield Generator: unlock costs `1 blueprint`.
  - Slow Field: unlock costs `2 blueprint`.
- Build mode now supports `Y` / `unlock_tech`:
  - Locked selected buildings cannot be placed.
  - Valid locked placement previews show a purple locked state.
  - HUD shows unlock cost plus `Y READY` or `Y NEED BLUEPRINT`.
- Objective Tracker now guides the player from Research Station into Shield Generator unlock/build, then Slow Field unlock/build, then turret upgrades.
- Added automated coverage for tech autoload loading, default unlock state, blueprint costs, failed unlocks, successful unlocks, and build-manager unlock status.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 160 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- CodeGraph status: `[OK] Index is up to date`; current GDScript project still indexes 0 files.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-08 - Headless Test Runner Repair

- Fixed `src/test_runner.gd` so it can run with Godot 4.6.2 `--script` by inheriting `SceneTree`.
- Reworked the system test runner to resolve autoloads through `/root` instead of compile-time singleton identifiers.
- Updated the turret test to match the current `fire_projectile()` API.
- Fixed `src/test_standalone.gd` to run as a `SceneTree` script with consistent space indentation.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
```

Results:

- `test_runner.gd`: 33 passed, 0 failed.
- `test_standalone.gd`: 29 passed, 0 failed.
- Godot 4.6.2 still prints RID/resource cleanup warnings after the generated headless scene exits, but both commands return exit code 0.

---

## 2026-06-08 - Player Movement Feel Fix

- Added continuous terrain following so walking downhill visibly follows the slope instead of feeling flat.
- Added grounded stick force and landing recovery so the player can move again after jumping.
- Added crouch/prone camera height changes so stance changes are visible.
- Added walking/sprinting camera bob and sprint FOV feedback so `Shift + W` feels faster.
- Applied zone speed bonuses to player movement speed.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Manual test steps:

- Walk forward on uneven terrain and verify the camera height follows downhill/uphill terrain.
- Press Space once, wait for landing, then confirm WASD movement still works.
- Hold Ctrl to crouch and Z to go prone; the camera should lower and movement should slow.
- Hold Shift + W; speed should increase, bob amplitude should increase, and FOV should widen slightly.

Follow-up:

- Fixed Shift modifier input blocking movement by reading WASD/arrow keys and Shift/Ctrl/Z through physical-key fallbacks in `player.gd`.
- Manual check: hold Shift first, then press W; press W first, then hold Shift. In both orders, forward movement should continue and sprint feedback should activate.

Invisible wall follow-up:

- Disabled the generated terrain mesh collision layer/mask because player grounding now uses `WorldGenerator.get_height_at()` directly.
- Added player stuck recovery: if movement input is held but horizontal displacement stays near zero for a short time, the player is nudged backward and snapped back to terrain height.
- Manual check: walk across rocky/uneven slopes and around zone entrances; if you hit a bad collision edge, movement should recover instead of freezing.

---

## 2026-06-08 - Build Defense MVP Slice

- Added `BuildManager` to `main.tscn`.
- Added `B` build mode for placing turrets with a green/red placement preview.
- Turret placement costs `20 iron + 5 void_crystal`, consumes resources through `InventoryManager`, and uses the existing turret scene.
- Added placement validation for resource affordability, range from player, base clearance, and turret spacing.
- Added `CombatHUD` showing base HP, day/night phase, wave number, enemies alive, and build hint/cost.
- Added `GameManager` signals for base HP and enemies alive.
- Added enemy kill rewards directly into the resource loop.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 38 passed, 0 failed.
- Main scene short startup: passed.

Manual test steps:

- Collect at least `20 iron` and `5 void_crystal`.
- Press `B`; verify the turret preview appears and changes color for valid/invalid placement.
- Left-click valid ground to place a turret; verify resources decrease and the turret remains active.
- Press right mouse or Esc to leave build mode.
- During night waves, verify the Combat HUD updates enemies alive and base HP.
- Kill enemies; verify resources increase from enemy rewards.

Build preview follow-up:

- Changed turret preview placement from a mouse `Y=0` plane hit to a player-forward terrain sample.
- Preview now sits at terrain height instead of floating above a flat placement plane.
- Preview colors now mean: green = placeable, yellow = valid position but missing resources, red = invalid position.

---

## 2026-06-09 - Prototype Cleanup Slice

- Removed obsolete placeholder/test scripts: `hello_test.gd`, `test_project.gd`, `system_test.gd`.
- Removed unused prototype scripts: `terrain_detail.gd`, `teleport_beacon.gd`, `forge_trigger.gd`.
- Removed duplicate UI scenes no longer instanced by `main.tscn`: `oxygen_ui.tscn`, `serum_ui.tscn`.
- Removed unused material resources now generated in code: `ground_material.tres`, `rock_material.tres`, `crystal_material.tres`.
- Archived historical sprint task/spec docs under `docs/archive/`.
- Removed unused `world_generator.gd` ExtResource from `main.tscn`; `WorldGenerator` remains an autoload.
- Updated `src/CONTEXT.md` to reflect current direct-HUD setup.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

---

## 2026-06-09 - O2 Supply Station Build Slice

- Added `O2Station`, a buildable oxygen refill structure inspired by the GDD O2 supply station / exploration tether design.
- Expanded `BuildManager` from single turret placement to multi-structure placement:
  - `1` selects Turret.
  - `2` selects O2 Station.
- O2 Station costs `15 iron + 10 biomass`.
- O2 Station refills player oxygen over time inside a short radius.
- Build preview keeps the same placement rules and terrain snapping as turret placement.
- Combat HUD now shows the selected building, selected cost, and build controls.
- Updated system test coverage for `o2_station.gd`.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 39 passed, 0 failed.
- `test_standalone.gd`: 29 passed, 0 failed.
- Main scene short startup: passed.

Manual test steps:

- Press `B`, press `2`, and verify the HUD says `O2 Station`.
- Collect `15 iron + 10 biomass`.
- Place an O2 Station on valid terrain.
- Walk away, let oxygen drain, return near the station, and verify oxygen refills.
- Press `1` to switch back to turret placement.

---

## 2026-06-09 - Base Repair And Wave Test Slice

- Added base repair as a connected survival-defense loop:
  - Base repair costs `10 iron + 5 biomass`.
  - Repair restores `25` Base HP.
  - Repair is only allowed when the base is damaged, so full-health repairs do not consume resources.
- Added `BaseInteraction` to `main.tscn`:
  - Press `E` near the base pod to repair.
  - Press `N` during day to immediately start night for manual wave testing.
- Hardened the day/night cycle with a cycle token so a skipped day timer cannot later start a duplicate night.
- Combat HUD now shows base repair and quick-night test hints.
- Added automated coverage for base repair behavior and the new main scene node.
- Added `docs/TEST_PLAN.md` as the single manual checklist for tonight's playtest.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

- `test_runner.gd`: 50 passed, 0 failed.
- `test_standalone.gd`: 29 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but all validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Turret Upgrade Slice

- Added turret upgrade support to `BuildManager`.
- Build mode now supports:
  - `U` upgrades the nearest turret under the preview.
- Turret upgrade costs `10 iron + 5 energy + 1 blueprint`.
- Max turret upgrade level is `3`.
- Each upgrade increases turret damage and fire rate.
- Upgraded turrets scale up slightly so the change has an in-world visual cue.
- Added `upgrade_structure` input action.
- Added automated coverage for upgrade cost, stat increase, level metadata, and max-level rejection.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

- `test_runner.gd`: 101 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but all validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Enemy Reward Rule Slice

- Fixed enemy reward semantics:
  - Combat kills still grant rewards.
  - Enemies that breach the base now call `die(false)` and do not grant kill rewards.
- Enemy `enemy_died` signal now carries `should_reward`.
- `GameManager.spawn_enemy()` binds the spawned enemy into `_on_enemy_died()` so reward logic can read `wave_variant` metadata.
- Added variant bonus rewards:
  - Scout: `+1 biomass`
  - Tank: `+2 iron`
  - Elite: `+1 void_crystal + 1 blueprint`
  - Boss: `+1 energy_core + 1 blueprint`
- Added automated coverage for boss variant bonus and no-reward base breach deaths.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 141 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Objective Tracker Slice

- Added `ObjectiveTracker`, a lightweight next-step guidance node.
- Objective priority currently covers:
  - Night defense.
  - Base repair when Base HP is damaged.
  - First Turret.
  - O2 Station.
  - Solar Panel.
  - Research Station.
  - Slow Field.
  - Turret upgrade.
  - General scan/expand fallback.
- Combat HUD now displays the objective line below the resource scanner hint.
- Main scene now includes an `ObjectiveTracker` node.
- Added automated coverage for script loading, main-scene wiring, and missing-resource text formatting.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 134 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Structure Repair Slice

- Added structure HP metadata for newly placed buildings:
  - `structure_health`
  - `structure_max_health`
- Added build-mode structure repair:
  - Press `R` near a damaged built structure under the preview.
  - Repair costs `5 iron + 2 biomass`.
  - Repair restores `35` structure HP up to max.
- Added connected damage source:
  - Enemy `base_reached` now sends a hit position.
  - `GameManager` damages nearby built structures when base breach damage gets through shield.
  - Shield absorption prevents structure splash damage when it absorbs the whole hit.
- Combat HUD now includes `R Repair` and shows damaged structure HP/readiness when aimed at a repair target.
- Added automated coverage for repair HUD status, repair resource cost, full-health rejection, and base-breach splash damage.
- Updated input map, GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 128 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Building Status HUD Slice

- Expanded `BuildManager` status APIs:
  - `get_recycle_status_text()` shows targeted structure label and expected refund.
  - `get_upgrade_status_text()` shows nearest turret level plus `READY`, `NEED RES`, or `MAX`.
  - `get_structure_label()` and `get_refund_text()` centralize HUD-facing status formatting.
- Combat HUD build hints now use two rows while build mode is open:
  - Row 1: build/recycle controls.
  - Row 2: selected building cost/placement readiness plus upgrade target status, or recycle target/refund status.
- Added automated coverage for recycle target/refund text and upgrade level/status text.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 116 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Enemy Wave Variant Slice

- Expanded night waves with visible enemy variants:
  - `Scout`: every 3rd wave unless replaced by elite/boss priority; smaller cyan enemy, faster and weaker.
  - `Tank`: every 4th wave unless replaced by scout/elite/boss priority; larger gold enemy, slower and tougher.
  - `Elite`: every 5th wave except boss waves; purple stronger enemy.
  - `Boss`: every 10th wave; red high-threat enemy.
- Combat HUD now shows the current wave variant label beside the wave number.
- Spawned enemies now store `wave_variant` and `wave_variant_label` metadata for future reward/UI hooks.
- Added variant tinting on enemy CSG primitive visuals.
- Added automated coverage for wave priority, labels, spawned metadata, and tinted visual assignment.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 111 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Building Recycle Slice

- Added recycle mode to `BuildManager`.
- Build mode controls now include:
  - `X` toggles recycle mode.
  - Left click recycles the nearest built structure under the preview.
- New placed structures now store `build_cost` and `build_label` metadata.
- Recycled structures refund `50%` of original material cost, minimum `1` per cost item.
- Recycle mode preview turns blue when a target can be recycled.
- Combat HUD shows recycle-mode instructions.
- Added `recycle_mode` input action.
- Added automated coverage for recycle refund and non-built node rejection.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

- `test_runner.gd`: 92 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but all validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Wave Warning HUD Slice

- Added phase countdown state to `GameManager`.
- Combat HUD now shows:
  - `Next night mm:ss` during day.
  - `Night ends mm:ss` during night.
  - Last wave approach direction.
- `GameManager` records the rough compass direction of the first spawned enemy in each wave.
- Added `wave_direction_changed(direction)` signal.
- Moved Combat HUD rows down to avoid overlap after adding the third status line.
- Added automated coverage for countdown text and direction labeling.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

- `test_runner.gd`: 86 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but all validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Slow Field Defense Slice

- Added reusable slow support to `Enemy`:
  - `apply_slow(source_id, multiplier)`
  - `remove_slow(source_id)`
  - `get_effective_speed()`
- Added `SlowField`, a buildable control defense.
- Expanded `BuildManager`:
  - `6` selects Slow Field.
  - Slow Field costs `15 iron + 8 biomass + 4 energy`.
- Slow Field reduces enemy movement speed to `45%` inside its radius.
- Enemies recover normal speed after leaving the field or when the field is removed.
- Combat HUD build hint now includes `6 Slow`.
- Added automated coverage for slow application and removal.
- Updated GDD, context docs, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

- `test_runner.gd`: 82 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but all validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Resource Scanner Slice

- Added `ResourceScanner`, matching the GDD P0 scanner priority.
- Resource nodes now join the `resource_nodes` group when ready.
- Main scene now has a `ResourceScanner` node.
- Combat HUD now shows nearest scanned resource distance and rough direction.
- `G` cycles scanner target type:
  - iron
  - biomass
  - void_crystal
  - energy_core
- Added automated coverage for scanner loading, main-scene wiring, and resource-type filtering.
- Updated `docs/GAME_DESIGN_DOC.md`, `src/CONTEXT.md`, and `docs/TEST_PLAN.md`.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

- `test_runner.gd`: 77 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but all validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - GDD MVP Execution Update And Research Station Slice

- Added a current MVP execution section to `docs/GAME_DESIGN_DOC.md`:
  - Current implemented systems.
  - Current MVP design target.
  - Near-term development order.
  - Manual test/documentation rule.
- Added `ResearchStation`, the first concrete technology-tree entry point.
- Expanded `BuildManager`:
  - `5` selects Research Station.
  - Research Station costs `20 iron + 5 void_crystal + 5 energy`.
- Research Stations consume `5 energy` every `20` seconds to produce `1 blueprint`.
- Research pauses automatically when energy is below `5`.
- Added automated coverage for research energy consumption and blueprint output.
- Updated `docs/TEST_PLAN.md` with Research Station manual test steps.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

- `test_runner.gd`: 71 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but all validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Solar Panel Energy Slice

- Added `energy` as a base power resource in `InventoryManager`.
- Updated Resource HUD labels/colors so generated `energy` is visible.
- Added `SolarPanel`, a Tier 1 base module aligned with the GDD solar-panel direction.
- Expanded `BuildManager`:
  - `4` selects Solar Panel.
  - Solar Panel costs `18 iron + 6 biomass`.
- Solar Panels generate `1 energy` every `5` seconds during daytime.
- Solar Panels stop generating during night, connecting power production to the day/night loop.
- Added automated coverage for the `energy` resource and solar panel generation behavior.
- Updated `docs/TEST_PLAN.md` with Solar Panel manual test steps.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

- `test_runner.gd`: 65 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but all validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Base Shield Generator Slice

- Added `ShieldGenerator`, a buildable base defense module from the GDD shield-generator direction.
- Expanded `BuildManager`:
  - `3` selects Shield Generator.
  - Shield Generator costs `25 iron + 8 void_crystal + 1 energy_core`.
- Shield Generators add `50` max shield to the base when built.
- Base shield absorbs enemy base damage before Base HP is reduced.
- Shield slowly recharges while shield capacity exists.
- Combat HUD now shows `Shield current/max`.
- Added automated coverage for shield registration and damage absorption.
- Updated `docs/TEST_PLAN.md` with shield generator manual test steps.

Validation plan:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

- `test_runner.gd`: 58 passed, 0 failed.
- `test_standalone.gd`: 29 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but all validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.
