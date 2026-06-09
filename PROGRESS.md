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
