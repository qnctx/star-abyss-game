# 🎮 星渊迷航 — 玩法设计修订版 (Gameplay Revision v2.1)

> **文档状态：历史版本，已由 `GAMEPLAY_v3.md` 取代。** 保留用于追溯 v2.1 的设计决策，不再作为当前开发入口。
>
> **文档目的：** 基于代码审计 + GPT Review 反馈，对玩法进行合理化修订。
> 本文档曾用于修订 `GAME_DESIGN_DOC.md` 的远期愿景；当前开发优先级以 `GAMEPLAY_v3.md` 为准。
> 远期愿景（载具、O₂ 管道网络、7 地图、食物/水/温度）保留但明确标记为 Post-MVP。

---

## 0. 修订背景

### 0.1 代码审计 + Review 发现的设计问题

| # | 问题 | 现状核实 | 修订方向 |
|---|------|----------|----------|
| D-01 | 区域适应系统不完整 | `player.gd` 已调用 `get_oxygen_multiplier()`/`get_speed_bonus()`，`serum_ui.gd` 已写入 `adaptations`，是 Lv0-Lv4 等级模型 | **补全**而非重建：HEAT 结构损耗未实现、GRAVITY 基础速度惩罚未实现、`get_speed_bonus()` 仅 Lv4 给加成 |
| D-02 | 传送系统交互断裂 | `teleport_manager.gd` 已有 3 个方法，`world_generator.gd` 已注册区域入口 | **打通**输入（`T` 键）、能量成本、UI 反馈 |
| D-03 | 每日资源刷新失效 | `GameManager.spawn_resources()` 用 `has_method()` 检查 `@export var`，恒 false | **删除**错误实现，改为 `WorldGenerator` 刷新**地下资源**（100x100 地图更稳定） |
| D-04 | GDD 愿景与实现脱节 | GDD 描述载具/O₂ 管道/7 区域/食物水温度，均未实现 | 文档层面分离，明确 Post-MVP |
| D-05 | 撤离线节奏 Bug | 信号台 `_ready()` 首帧可能发射；读档可能立即触发撤离完成 | 纯 Bug 修复 |
| D-06 | 区域压力不完整 | COLD 氧耗已生效；HEAT/GRAVITY 压力未实现 | 补全 HEAT 结构损耗 + GRAVITY 速度惩罚 |

### 0.2 修订原则（Review 后调整）

1. **承认现状** — 不推倒重写已接入的系统，只补全缺失部分
2. **数值自洽** — 所有数值必须与现有代码和经济曲线对齐
3. **地图约束** — 100x100 地图（`WORLD_HALF = 50`）限制下设计刷新算法
4. **最小改动** — 优先复用已有方法签名，避免破坏 SaveManager 等
5. **可验证** — 每个修订点有明确的"如何验证已生效"

---

## 1. 核心循环（修订后）

### 1.1 单局循环

```
┌─────────────────────────────────────────────────────────────┐
│                        白天 (960s / 16 分钟)                 │
│  探索新区域 → 承受区域压力 → 采集资源 → 发现地下矿藏           │
│       ↓                                                      │
│  返回基地 → 酿造血清/升级科技 → 建造防御 → 激活信号台进度      │
└─────────────────────────────────────────────────────────────┘
                          ↓ 夜晚来临
┌─────────────────────────────────────────────────────────────┐
│                        夜晚 (480s / 8 分钟)                  │
│  敌人波次来袭 → 玩家+防御塔协同防守 → 击杀获得变体奖励         │
│       ↓                                                      │
│  修理受损建筑 → 清点战利品 → 准备次日深入                     │
└─────────────────────────────────────────────────────────────┘
                          ↓ 重复
┌─────────────────────────────────────────────────────────────┐
│                  长线推进 (约 5-7 个游戏日)                   │
│  信号进度 0→25→50→75→100% → 撤离坚守 → 结局                  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 昼夜时长

保持现有代码数值不变：
- 白天 960s（16 分钟）
- 夜晚 480s（8 分钟）
- 单日总长 24 分钟
- 单局 5-7 日 ≈ 120-170 分钟

---

## 2. 区域系统（D-01, D-06 修订）

### 2.1 设计目标

承认现有 Lv0-Lv4 等级适应系统已部分接入，目标是**补全缺失的压力维度**，让 4 个区域真正玩起来不一样。

### 2.2 现有系统核实

`zone_manager.gd` 已有：
- `ZONE_PRESSURE = {CRASH: 1.0, COLD: 3.0, HEAT: 3.5, GRAVITY: 4.0}` — 区域压力基础值
- `ADAPTATION_EFFECTS = [0.0, 0.20, 0.40, 0.70, 1.00]` — Lv0-Lv4 适应抵消系数
- `ADAPTATION_BONUSES` — Lv4 额外奖励（speed_bonus / immunity）
- `get_oxygen_multiplier()` — 已被 `player.gd:178` 调用 ✅
- `get_speed_bonus()` — 已被 `player.gd:132` 调用，但仅 Lv4 给 speed_bonus ⚠️
- `adaptations` 字典 — 已被 `serum_ui.gd:179` 写入 ✅

### 2.3 缺失维度补全

| 区域 | 现有压力 | 缺失压力 | 修订方案 |
|------|----------|----------|----------|
| CRASH | 氧耗 ×1.0 | 无 | 保持安全区 |
| COLD | 氧耗 ×3.0（已生效） | 无 | 保持，Lv 等级渐进抵消 |
| HEAT | 氧耗 ×3.5（已生效） | **结构损耗未实现** | 新增 `get_structure_drain_rate()`，HEAT 区建筑每秒损失 0.3 HP；Lv2+ 免疫 |
| GRAVITY | 氧耗 ×4.0（已生效） | **基础速度惩罚未实现** | 新增 `get_speed_multiplier()`，GRAVITY 区速度 ×0.7；Lv2+ 恢复至 1.0× |

### 2.4 HEAT 结构损耗设计（Review #5 修订）

**问题：** 原设计每秒 0.5 HP 会让前哨建筑（O2 Station/Signal Beacon/Solar Panel）变负收益。

**修订：**
- 损耗速率降为 **0.3 HP/s**（建筑默认 HP 100，可撑约 5 分钟）
- **Lv2 适应即可免疫**（不是 Lv4），降低前哨成本
- 损耗由 **结构自身脚本** 应用（`turret.gd`/`o2_station.gd` 等在 `_process` 中检查），不放在 `build_manager.gd`
- HEAT 区资源分布偏向 `energy_core`，让前哨有高价值回报

### 2.5 GRAVITY 速度惩罚设计

**问题：** 现有 `get_speed_bonus()` 仅 Lv4 给 +15%/+20% 加成，无基础惩罚。

**修订：**
- 新增 `get_speed_multiplier()` 方法，返回基础速度倍率
- GRAVITY 区 Lv0-1：返回 0.7（速度 ×0.7）
- GRAVITY 区 Lv2+：返回 1.0（恢复正常）
- `player.gd` 在 `current_speed *= 1.0 + ZoneManager.get_speed_bonus()` 之后，再乘以 `ZoneManager.get_speed_multiplier()`

### 2.6 血清适应流程（保留 Lv0-Lv4）

```
1. 玩家进入 COLD 区域 → 氧耗 ×3.0
2. 死亡或撤退 → 回基地
3. 打开 SerumUI (T 键) → 酿造 cold_1 (Lv1)
4. ZoneManager.adaptations[COLD] = 1
5. 再次进入 COLD → 氧耗 ×3.0 ×(1-0.2×0.9) ≈ ×2.46
6. 继续酿造至 Lv4 → 氧耗 ×3.0 ×(1-1.0×0.9) = ×0.3
```

### 2.7 接入点（代码层面）

| 脚本 | 改动 | 类型 |
|------|------|------|
| `zone_manager.gd` | 新增 `get_speed_multiplier() -> float` | 新增方法 |
| `zone_manager.gd` | 新增 `get_structure_drain_rate() -> float` | 新增方法 |
| `player.gd:132` | 速度计算追加 `*= get_speed_multiplier()` | 修改 1 行 |
| `turret.gd` 等 | `_process` 中调用 `get_structure_drain_rate()` 应用损耗 | 各脚本新增 |
| `serum_ui.gd` | 无改动（已正确写入 adaptations） | 无 |

---

## 3. 传送系统（D-02 修订）

### 3.1 设计目标

承认传送系统已半接入，目标是**打通交互断裂**：输入、能量成本、UI 反馈。

### 3.2 现有系统核实

`teleport_manager.gd` 已有：
- `register_beacon(beacon, zone)` ✅
- `teleport_to_base(player, from_zone)` ✅
- `teleport_to_beacon(player, to_zone)` ✅
- `world_generator.gd:680` 已注册 4 个区域入口 ✅

**缺失：**
- `player.gd` 有 `_try_teleport()` 但无输入调用
- 无能量成本检查
- 无 UI 反馈

### 3.3 修订方案

**保留 `T` 键**（不迁移到 V，避免改 `project.godot` 输入映射）。

> 注：`T` 键当前同时用于打开 SerumUI。需要冲突处理：建造模式下 `T` 传送，非建造模式下 `T` 打开血清。或者改为 `T` 打开血清，`Shift+T` 传送。**建议后者**，避免上下文切换混乱。

#### 传送规则

- 按键：`Shift+T`（基地附近）打开传送面板
- 消耗：`5 energy` per use（原 10 偏高）
- 限制：
  - 仅白天可传送（夜晚禁止）
  - 仅基地附近 10m 内可触发
  - 目标必须是已注册的信标（区域入口或玩家建造的 Signal Beacon）
- 传送后短暂无敌 2s（避免落地被怪秒）

#### 接入点

| 脚本 | 改动 |
|------|------|
| `player.gd` | `_process` 检测 `Shift+T` 输入，调用 `TeleportManager` |
| `teleport_manager.gd` | `teleport_to_beacon` 增加能量消耗 + 白天检查 |
| `combat_hud.gd` | 显示可用传送点 + 能量状态 |

---

## 4. 资源刷新机制（D-03 修订）

### 4.1 设计目标

修复"资源枯竭后卡死"问题，在 100x100 地图约束下提供稳定刷新算法。

### 4.2 现有系统核实

- `GameManager.spawn_resources()` — `has_method("resource_type")` 检查 `@export var`，恒 false，**删除**
- `WorldGenerator` 已生成初始可见资源 + 地下资源
- 地图 `WORLD_HALF = 50`（100x100）

### 4.3 修订方案（Review #4 采纳）

**核心改动：** 每日刷新**地下资源**而非可见资源。

理由：
- 地下资源需要 Scanner 揭示 + Harvester 挖掘，天然有探索成本
- 地下资源不在地表，不会与现有可见资源争夺空间
- 算法更稳定：只需在地下资源数组中追加新节点

#### 刷新规则

| 事件 | 时机 | 行为 |
|------|------|------|
| 世界生成 | 游戏开始 | `WorldGenerator` 生成初始地下资源（已实现） |
| 每日刷新 | 每个白天开始 | 在远离基地 25m+ 的位置，生成 2-3 个新地下资源 |
| 节点耗尽 | 玩家挖掘完 | 节点 `queue_free()`，不重生 |
| 上限保护 | 任何时候 | 地下资源总数 ≤ 60 个，超出则不刷新 |

#### 新节点生成算法

```
1. 获取当前地下资源数量
2. 若 >= 60，跳过本次刷新
3. 尝试 20 次生成位置：
   a. 随机位置 (x ∈ [-45, 45], z ∈ [-45, 45])
   b. 距离基地 (0,0) > 25m
   c. 距离已有地下资源 > 8m
   d. 距离已有可见资源 > 5m
4. 若 20 次找不到合法点，放宽距离要求至 > 4m 再试 10 次
5. 若仍失败，跳过本次刷新（不报错）
6. 成功则按游戏日加权选择资源类型：
   - Day 1-2: 70% iron, 20% biomass, 10% void_crystal
   - Day 3-4: 40% iron, 30% void_crystal, 20% energy_core, 10% biomass
   - Day 5+:  30% void_crystal, 30% energy_core, 20% blueprint, 20% iron
```

### 4.4 接入点

| 脚本 | 改动 | 类型 |
|------|------|------|
| `game_manager.gd` | **删除** `spawn_resources()` 整个方法 | 删除 |
| `game_manager.gd` | `_on_day_started` 改为调用 `WorldGenerator.spawn_daily_buried(day_number)` | 修改 |
| `world_generator.gd` | 新增 `spawn_daily_buried(day: int)` 方法 | 新增 |
| `combat_hud.gd` | 黎明时提示"新矿藏已出现" | 新增 |

---

## 5. 信号与撤离线（D-05 修订）

### 5.1 设计目标

修复 Bug + 保持现有离散节奏，不改为连续消耗。

### 5.2 现有系统核实

`signal_beacon.gd` 当前：
- `SIGNAL_INTERVAL := 6.0`（每 6 秒一个周期）
- `SIGNAL_PROGRESS_PER_CYCLE := 10.0`（每周期 +10%）
- `ENERGY_COST := {"energy": 1}`（每周期消耗 1 energy）
- 100% 需要 10 周期 × 6 秒 = 60 秒，消耗 10 energy

`signal_log_manager.gd` 当前：
- `EXTRACTION_HOLDOUT_DURATION := 180.0`（180 秒）

### 5.3 修订方案

**保持现有离散节奏**，仅调整数值让单局时长合理：

| 参数 | 原值 | 修订 | 理由 |
|------|------|------|------|
| `SIGNAL_INTERVAL` | 6.0s | **12.0s** | 原节奏过快，60s 就 100% |
| `SIGNAL_PROGRESS_PER_CYCLE` | 10.0 | **5.0** | 配合 interval，100% 需 20 周期 × 12s = 240s = 4 分钟 |
| `ENERGY_COST` | 1 energy | **1 energy** | 保持，总消耗 20 energy，与经济曲线匹配 |

**总时长：** 240 秒（4 分钟）信号 + 180 秒（3 分钟）撤离 = 7 分钟终局，合理。

### 5.4 Bug 修复

| Bug | 修复方式 |
|-----|----------|
| 信号台首帧发射 | `_ready()` 中 `set_process(false)`，1 秒后 `set_process(true)` |
| 读档触发撤离完成 | `signal_log_manager.gd` 读档时检查 `extraction_holdout_complete` 标志，若为 true 但 `extraction_holdout_active` 为 false，不重新触发 |

### 5.5 撤离坚守规则（统一）

- 信号 100% 后触发撤离坚守，倒计时 **180 秒**（与代码一致）
- 撤离期间强制夜晚，敌人波次强度 ×1.5
- **信号台 HP = 基地 HP**（不引入独立 HP，简化系统）
- 基地 HP 归零 → 撤离失败 → Game Over
- 倒计时结束 → Victory

---

## 6. 玩家成长曲线

### 6.1 每日强度递增

| 游戏日 | 白天探索 | 夜晚波次 | 推荐信号进度 |
|--------|----------|----------|--------------|
| Day 1 | CRASH 区域熟悉 | 5-8 普通敌人 | 0% |
| Day 2 | CRASH 资源采集 + 首个建筑 | 8-12 普通 + 1 Tank | 0-10% |
| Day 3 | 进入 COLD 区域（未适应） | 12 普通 + 2 Tank + 1 Elite | 10-25% |
| Day 4 | 酿造 cold_1，深入 COLD | 15 普通 + 2 Tank + 1 Elite | 25-50% |
| Day 5 | 进入 HEAT 或 GRAVITY | 18 普通 + 3 Tank + 2 Elite | 50-75% |
| Day 6 | 适应第二区域，采集终局资源 | 20 普通 + 3 Tank + 2 Elite + 1 Boss | 75-100% |
| Day 7 | 撤离坚守 | 撤离波次（强度 ×1.5，180s） | Victory/Defeat |

### 6.2 资源经济曲线（与信号消耗对齐）

| 资源 | Day 1-2 需求 | Day 3-4 需求 | Day 5-6 需求 |
|------|--------------|--------------|--------------|
| iron | 30-50 (基础建筑) | 80-120 (升级+修理) | 100-150 (终局防御) |
| biomass | 10-20 | 30-50 (血清 Lv1-2) | 40-60 |
| void_crystal | 0-5 | 15-25 (血清 Lv2-3) | 30-50 |
| energy | 20-30 | 40-60 (信号台+研究) | 60-80 (信号冲刺) |
| energy_core | 0-2 | 5-10 (血清 Lv3) | 10-20 |
| blueprint | 0-3 | 5-10 (血清+解锁) | 10-15 |

> 信号台总消耗约 20 energy，分布在 Day 3-6，每日 5 energy 左右，与曲线匹配。

---

## 7. Post-MVP 明确延期内容

以下系统**不**在当前修订范围内，明确标记为 Post-MVP：

| 系统 | 原因 | 重启条件 |
|------|------|----------|
| 载具系统 (探索小艇/机甲/背包) | 当前步行+传送已满足探索需求 | 当地图扩展到 1000m+ 时 |
| O₂ 管道网络 | O2 Station + O2 Kit 已满足探索续航 | 当单次探索距离超过 200m 时 |
| 食物/水/温度需求 | 氧气已是足够的生存压力 | 当玩家反馈生存压力不足时 |
| 7 地图区域扩展 | 4 区域已足够支撑 120 分钟单局 | 当 4 区域垂直切片验证通过后 |
| 多种敌人类型 (飞行/投石) | Scout/Tank/Elite/Boss 已足够 | 当防守策略深度不足时 |
| 难度模式 (探索/生存/硬核) | 当前固定生存模式即可 | 当核心循环稳定后 |

---

## 8. 修订点验证清单

| 修订点 | 验证方式 | 涉及脚本 |
|--------|----------|----------|
| D-01 区域适应补全 | HEAT 区建筑每秒掉 0.3 HP；Lv2 适应后不掉血 | `zone_manager.gd`, 结构脚本 |
| D-02 传送打通 | 基地附近 `Shift+T` 打开传送，消耗 5 energy 传到区域入口 | `player.gd`, `teleport_manager.gd`, `combat_hud.gd` |
| D-03 地下资源刷新 | 第 2 日黎明，地下资源数量 +2~3；总量 ≤ 60 | `world_generator.gd`, `game_manager.gd` |
| D-04 愿景分离 | 本文档明确标记 Post-MVP | 文档层面 |
| D-05 撤离 Bug 修复 | 读档不立即触发撤离；信号台首帧不发射 | `signal_beacon.gd`, `signal_log_manager.gd` |
| D-06 GRAVITY 速度惩罚 | GRAVITY 区 Lv0 速度 ×0.7；Lv2 恢复 1.0× | `zone_manager.gd`, `player.gd` |

---

## 9. 与现有代码的对应关系

### 9.1 需要补全的现有半接入代码

| 脚本 | 现状 | 修订后用途 |
|------|------|-----------|
| `zone_manager.gd` | `get_oxygen_multiplier()`/`get_speed_bonus()` 已接入 | 新增 `get_speed_multiplier()` + `get_structure_drain_rate()` |
| `teleport_manager.gd` | 3 个方法已存在但无输入调用 | `player.gd` 接入 `Shift+T` 输入 + 能量成本 |
| `serum_recipes.gd` | Lv0-Lv4 配方已存在，`serum_ui.gd` 已写入 adaptations | 无改动 |
| `signal_beacon.gd` | 离散节奏已存在 | 调整数值 + 修复首帧 Bug |

### 9.2 需要删除的代码

| 脚本 | 删除内容 | 理由 |
|------|----------|------|
| `game_manager.gd` | `spawn_resources()` 整个方法 | `has_method()` Bug + 与 WorldGenerator 职责重叠 |
| `game_manager.gd` | `_on_day_started` 中对 `spawn_resources()` 的调用 | 改为调用 `WorldGenerator.spawn_daily_buried()` |

### 9.3 需要新增/修改的方法

| 脚本 | 方法 | 类型 |
|------|------|------|
| `zone_manager.gd` | `get_speed_multiplier() -> float` | 新增 |
| `zone_manager.gd` | `get_structure_drain_rate() -> float` | 新增 |
| `player.gd` | 速度计算追加 `*= get_speed_multiplier()` | 修改 1 行 |
| `player.gd` | `_process` 检测 `Shift+T` 输入 | 新增 |
| `turret.gd` 等 | `_process` 应用 `get_structure_drain_rate()` | 新增 |
| `teleport_manager.gd` | `teleport_to_beacon` 增加能量消耗 + 白天检查 | 修改 |
| `world_generator.gd` | `spawn_daily_buried(day: int)` | 新增 |
| `signal_beacon.gd` | `_ready()` 添加 1s 延迟发射 | 修改 |
| `signal_beacon.gd` | 数值调整 `SIGNAL_INTERVAL=12`, `SIGNAL_PROGRESS_PER_CYCLE=5` | 修改 |
| `signal_log_manager.gd` | 读档时不重复触发撤离 | 修改 |
| `combat_hud.gd` | 传送点显示 + 黎明提示 | 新增 |

---

## 10. 开发优先级

| 优先级 | 修订点 | 理由 |
|--------|--------|------|
| P0 | D-05 撤离 Bug 修复 | 纯 Bug，无设计争议 |
| P0 | D-03 资源刷新修复 | 阻塞长线生存 |
| P1 | D-01 + D-06 区域压力补全 | 核心玩法纵深 |
| P2 | D-02 传送打通 | 体验优化 |
| P2 | D-04 愿景分离 | 文档层面 |

---

## 11. 不变内容

- 氧气系统核心机制（O2 容量、O2 Plant、O2 Kit、O2 Station）
- 建造系统 7 种建筑
- 武器系统 5 种武器 × 5 品质
- 敌人 4 种变体（Scout/Tank/Elite/Boss）
- 死亡掉落机制
- 科技解锁机制（Y 键消耗 blueprint）
- 存档/读档机制（F6/F7）
- 工具栏 5 槽
- 准星统一瞄准系统
- 血清 Lv0-Lv4 等级模型（不改为布尔）
- 信号台离散节奏（不改为连续消耗）
- 撤离坚守 180 秒

---

> **本文档状态：** v2.1 历史版本，当前执行版见 `GAMEPLAY_v3.md`
> **创建时间：** 2026-06-26
> **相关文档：** `GAME_DESIGN_DOC.md`（远期愿景）、`REVIEW.md`（当前代码审查）
