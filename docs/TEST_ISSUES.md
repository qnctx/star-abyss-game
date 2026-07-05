# 代码审查问题清单 (TEST_ISSUES.md)

> 审查日期：2026-06-25（第二轮深度复审）
> 审查范围：`src/scripts/` 下全部 42 个 GDScript 文件 + `src/project.godot` + `src/scenes/main.tscn`
> 严重程度：🔴 严重 | 🟡 一般 | 🟢 建议优化
> 复审说明：本次重新通读所有脚本，修正了首轮漏检的运行时崩溃、逻辑错误，并新增对场景文件与 autoload 配置的交叉验证。

---

## Codex 复核意见与本轮处理状态（2026-06-25）

- **总体意见**：我同意第一批严重问题的优先级。S-01、S-03、S-05 都是明确可复现的代码缺陷；S-06 的除零与重启入口也应当修。S-02/S-04 需要合并处理，不建议把 `spawn_resources()` 简单修到每天生效，否则会把 WorldGenerator 已生成的全局资源布局变成每日基地周围资源膨胀。
- **本轮已处理**：S-01、S-03、S-05、S-06；S-02/S-04 采用“日循环不再调用 `spawn_resources()`，该函数仅保留为显式补充入口”的修法；同时顺手完成 G-01、G-02、G-03（GameManager 部分）和 G-05。
- **仍建议保留**：G-14/G-17/G-18/G-19/G-20 属于多文件数据源收敛，应该单独开重构切片，不适合混入本轮 bugfix。
- **测试补充**：已给 `InventoryManager.consume_resources()` 增加自动测试，覆盖余额不足时返回 `false` 且库存不变，防止再次出现负数资源。

---

## 🔴 严重问题（必须修复）

### S-01 `player_projectile.gd` 调用 `apply_slow` 参数缺失（运行时崩溃）
- **状态**：✅ 已修复（`player_projectile.gd` 现在传入稳定的 `"player_projectile"` source id）。
- **文件**：[src/scripts/player_projectile.gd](file:///e:/myProject/star-abyss-game/src/scripts/player_projectile.gd#L44-L46)
- **现象**：冰冻武器命中敌人时调用 `body.apply_slow(slow_amount)`，只传 1 个参数。
- **原因**：[enemy.gd:59](file:///e:/myProject/star-abyss-game/src/scripts/enemy.gd#L59) 的方法签名是 `func apply_slow(source_id: String, multiplier: float)`，必须 2 个参数。[slow_field.gd:26](file:///e:/myProject/star-abyss-game/src/scripts/slow_field.gd#L26) 已正确传 `_source_id` 与 `SLOW_MULTIPLIER`。
- **影响**：玩家使用 ice_ray 击中敌人的瞬间触发 "Too few arguments" 错误，弹药失效。
- **修复**：`body.apply_slow("player_projectile", slow_amount)`，或新增独立 source_id 常量。

### S-02 `game_manager.gd:spawn_resources()` 资源从不生成（死代码 + 逻辑错误）
- **状态**：✅ 已修复为兼容入口；日循环不再调用该函数，函数内部也不再使用错误的 `has_method("resource_type")` 判断。
- **文件**：[src/scripts/game_manager.gd:371-383](file:///e:/myProject/star-abyss-game/src/scripts/game_manager.gd#L371-L383)
- **现象**：`start_day()` 在第 63 行调用 `spawn_resources()`，但该方法实际从未生成任何资源节点。
- **原因**：第 379 行 `if node and node.has_method("resource_type"):` — `resource_type` 是 [resource_node.gd:4](file:///e:/myProject/star-abyss-game/src/scripts/resource_node.gd#L4) 上的 `@export var` 属性，并非方法，`has_method()` 永远返回 `false`，导致整个 if 块跳过。
- **影响**：白天本应在基地周围补充 15 个资源节点的逻辑从未生效；目前由 [world_generator.gd](file:///e:/myProject/star-abyss-game/src/scripts/world_generator.gd) 在初次生成时一次性铺设资源，所以游戏看似正常，但每日刷新机制完全失效。
- **修复**：把判断改为 `if node:` 并直接设置属性；同时确认是否真的需要在 `start_day()` 中重复生成（与 WorldGenerator 职责重叠）。

### S-03 `inventory_manager.gd:consume_resources()` 不校验余额可致负数
- **状态**：✅ 已修复；`consume_resources()` 现在是原子校验，失败返回 `false` 且不修改库存，主要调用方也已检查返回值。
- **文件**：[src/scripts/inventory_manager.gd:29-32](file:///e:/myProject/star-abyss-game/src/scripts/inventory_manager.gd#L29-L32)
- **现象**：`consume_resources()` 直接 `resources[type] -= requirements[type]`，无任何校验。
- **影响**：任何调用方若未先调用 `has_resources()` 检查（或两步之间被其他信号消费），资源将变为负数，破坏后续所有 `has_resources()` 判断。当前调用方普遍先检查再消费，但 [tech_manager.gd:67-73](file:///e:/myProject/star-abyss-game/src/scripts/tech_manager.gd#L67-L73) 的 `unlock()`、[signal_beacon.gd:41-48](file:///e:/myProject/star-abyss-game/src/scripts/signal_beacon.gd#L41-L48) 的 `_try_transmit_signal()`、[oxygen_canister_manager.gd:25-31](file:///e:/myProject/star-abyss-game/src/scripts/oxygen_canister_manager.gd#L25-L31) 的 `craft_canister()` 等都是"先检查后消费"模式，存在竞态窗口。
- **修复**：在 `consume_resources()` 内部对每个 type 校验余额，不足时返回 `false` 并保持原值不变；让调用方根据返回值决定行为。

### S-04 `game_manager.gd:spawn_resources()` 与 WorldGenerator 职责重复
- **状态**：✅ 已按复核意见处理；`start_day()` 不再每日刷资源，避免修复 S-02 后产生资源膨胀。
- **文件**：[src/scripts/game_manager.gd:63, 371-383](file:///e:/myProject/star-abyss-game/src/scripts/game_manager.gd#L63)
- **现象**：`start_day()` 调用 `spawn_resources()`，而 [world_generator.gd](file:///e:/myProject/star-abyss-game/src/scripts/world_generator.gd) 已在初始化时铺设全部资源。
- **影响**：若修复 S-02 后此函数生效，会导致每天在基地周围 3-12m 半径内重复刷出 15 个资源节点，与 WorldGenerator 的全局资源分布设计冲突，且资源会越积越多。
- **修复**：与 S-02 一并处理 — 要么删除 `spawn_resources()` 与 `start_day()` 中的调用，要么明确改为"补充远处消耗掉的资源"的有限刷新策略。

### S-05 `serum_ui.gd` 资源标签打印两次（UI 显示错误）
- **状态**：✅ 已修复。
- **文件**：[src/scripts/serum_ui.gd:155](file:///e:/myProject/star-abyss-game/src/scripts/serum_ui.gd#L155)
- **现象**：`line.text = "%s%s: %d" % [RESOURCE_LABELS.get(res, res), RESOURCE_LABELS.get(res, res), amount]` — 同一个 `RESOURCE_LABELS.get(res, res)` 出现两次。
- **影响**：血清调制台右侧"库存材料"列表显示成 `铁铁: 12`、`晶晶: 5`，而非预期的 `铁: 12`。
- **修复**：改为 `"%s: %d" % [RESOURCE_LABELS.get(res, res), amount]`。

### S-06 `oxygen_ui.gd` 除零风险 + 重启不重置游戏状态
- **状态**：✅ 已修复；氧气百分比增加 `maximum <= 0` 防护，重新开始按钮改为调用 `GameManager.reset_game()`，统一清理波次、敌人、建筑、库存、科技、死亡掉落与信号日志。
- **文件**：[src/scripts/oxygen_ui.gd:43-51, 62-71](file:///e:/myProject/star-abyss-game/src/scripts/oxygen_ui.gd#L43-L51)
- **现象 A**：第 43、44、46、48 行 `current / maximum` 未防 `maximum == 0`，若玩家因 bug 导致 `max_oxygen=0` 则除零。
- **现象 B**：`_on_restart_pressed()` 只调用 `player.respawn()` 并重置 UI 显示，但完全没有重置 [GameManager](file:///e:/myProject/star-abyss-game/src/scripts/game_manager.gd) 的 `wave_number`、`enemies_alive`、`base_health`、白天/夜晚阶段，也没清理场上残存的敌人和已建造结构。点击"重新开始"后玩家会在残留的夜波中重生。
- **修复**：A 加 `if maximum <= 0: return`；B 应当通过 GameManager 提供一个 `reset_game()` 接口统一重置所有系统状态。

---

## 🟡 一般问题（应修复）

### G-01 `player.gd:14` 混入俄文注释
- **状态**：✅ 已修复。
- **文件**：[src/scripts/player.gd:14](file:///e:/myProject/star-abyss-game/src/scripts/player.gd#L14)
- **现象**：`const STUCK_VELOCITY_THRESHOLD: float = 0.5  # Below this velocity считается "застрял"` — "считается застрял" 是俄文。
- **修复**：改为 `# Below this velocity the player is considered stuck`。

### G-02 `player.gd` `_debug_frames` 变量未使用
- **状态**：✅ 已修复。
- **文件**：[src/scripts/player.gd:92, 98](file:///e:/myProject/star-abyss-game/src/scripts/player.gd#L92)
- **现象**：`var _debug_frames: int = 0` 在 `_physics_process` 中每帧自增但从未被读取。
- **修复**：删除变量声明与第 98 行自增语句。

### G-03 `game_manager.gd` 多处使用 `load()` 而非 `preload()`
- **状态**：✅ GameManager 部分已修复。
- **文件**：[src/scripts/game_manager.gd:131, 378](file:///e:/myProject/star-abyss-game/src/scripts/game_manager.gd#L131)
- **现象**：`spawn_enemy()` 中 `load("res://scenes/enemy.tscn")` 每次生成敌人都重新加载；`spawn_resources()` 中 `load("res://scenes/resource_node.tscn")` 同样。
- **修复**：在文件顶部用 `const ENEMY_SCENE := preload(...)` 替代，参考 [save_manager.gd:23](file:///e:/myProject/star-abyss-game/src/scripts/save_manager.gd#L23) 的 `ENEMY_SCENE` 写法。

### G-04 `game_manager.gd:26` 未使用常量
- **文件**：[src/scripts/game_manager.gd:26](file:///e:/myProject/star-abyss-game/src/scripts/game_manager.gd#L26)
- **现象**：`const ENEMIES_PER_WAVE_INCREMENT: int = 2` 定义后从未被引用。
- **修复**：删除或在 `spawn_wave()` 的难度计算中实际使用。

### G-05 `game_manager.gd:403` 残留 debug print
- **状态**：✅ 已修复。
- **文件**：[src/scripts/game_manager.gd:403](file:///e:/myProject/star-abyss-game/src/scripts/game_manager.gd#L403)
- **现象**：`print("GAME OVER - Base destroyed!")` 在 `game_over()` 中。
- **修复**：删除 print，改为通过信号通知 UI（与 `oxygen_ui.gd` 的 GameOverPanel 联动）。

### G-06 `save_manager.gd:394` 残留 debug print
- **文件**：[src/scripts/save_manager.gd:394](file:///e:/myProject/star-abyss-game/src/scripts/save_manager.gd#L394)
- **现象**：`_set_status()` 末尾 `print("SaveManager: %s" % message)` 每次存读档都打印。
- **修复**：删除 print，状态已通过 `save_status_changed` 信号传给 [combat_hud.gd](file:///e:/myProject/star-abyss-game/src/scripts/combat_hud.gd)。

### G-07 `world_generator.gd` 21 处 debug print
- **文件**：[src/scripts/world_generator.gd](file:///e:/myProject/star-abyss-game/src/scripts/world_generator.gd)（行 64、77、81、84、135、137、140、144、147、149、151、175、436、457、487、524、537、558、603、648、682）
- **现象**：21 条 `print("WorldGenerator: ...")` 调试输出贯穿整个地形生成流程。
- **修复**：全部删除，或改为可选的 `verbose_log()` 工具（受 const 开关控制）。

### G-08 `enemy.gd:139` `preload` 写在函数体内
- **文件**：[src/scripts/enemy.gd:139-149](file:///e:/myProject/star-abyss-game/src/scripts/enemy.gd#L139-L149)
- **现象**：`var ExplosionScene = preload("res://scenes/vfx_explosion.tscn")` 写在 `die()` 函数内。虽然 `preload` 是编译期常量不会真的每次加载，但写法不规范。
- **修复**：移到文件顶部 `const EXPLOSION_SCENE := preload(...)`。

### G-09 `enemy.gd:die()` 使用 `await` 延迟 `queue_free`
- **文件**：[src/scripts/enemy.gd:134-150](file:///e:/myProject/star-abyss-game/src/scripts/enemy.gd#L134-L150)
- **现象**：`die()` 中 `await get_tree().create_timer(0.5).timeout` 后才 `queue_free()`，期间敌人节点仍存在于场景中。
- **影响**：0.5 秒内敌人仍在 `enemies` 组中，[turret.gd](file:///e:/myProject/star-abyss-game/src/scripts/turret.gd) 的 `find_nearest_enemy()`、[slow_field.gd](file:///e:/myProject/star-abyss-game/src/scripts/slow_field.gd) 的 `_process()` 仍会把它当作有效目标。所幸 `_has_died = true` 阻止了重复触发 `die()` 和 `_physics_process`。
- **修复**：先 `queue_free()`，再独立创建爆炸 VFX 节点（VFX 自带 lifetime 自动释放）。

### G-10 `turret.gd` 使用 `load()` 而非 `preload()`
- **文件**：[src/scripts/turret.gd](file:///e:/myProject/star-abyss-game/src/scripts/turret.gd)（行 54、61，按首轮摘要）
- **现象**：`projectile_scene = load(...)`、`muzzle_flash_scene = load(...)` 在运行时加载。
- **修复**：改为 `const PROJECTILE_SCENE := preload(...)`。

### G-11 `turret.gd` 无目标时每帧遍历全部敌人
- **文件**：[src/scripts/turret.gd](file:///e:/myProject/star-abyss-game/src/scripts/turret.gd)
- **现象**：`find_nearest_enemy()` 在 `_process` 中每帧调用，遍历 `get_nodes_in_group("enemies")`。
- **修复**：增加冷却（如 0.2s 扫描一次）或使用 Area3D 检测进入范围的敌人。

### G-12 `weapon_controller.gd` 每次调用 `get_aim_direction()` 都 `new` AimTargeting
- **文件**：[src/scripts/weapon_controller.gd:91](file:///e:/myProject/star-abyss-game/src/scripts/weapon_controller.gd#L91)（按首轮摘要）
- **现象**：`AIM_TARGETING.new()` 在每次 `get_aim_direction()` 调用时创建新实例，造成不必要的 RefCounted 分配。
- **修复**：在文件顶部 `const AIM_TARGETING := preload(...)` 后用类内缓存的单一实例（`var _aim := AIM_TARGETING.new()`）。

### G-13 `weapon_controller.gd` 武器数据硬编码
- **文件**：[src/scripts/weapon_controller.gd:11-17](file:///e:/myProject/star-abyss-game/src/scripts/weapon_controller.gd#L11-L17)（按首轮摘要）
- **现象**：5 把武器的 `damage`/`fire_rate`/`ammo_per_shot` 等数据硬编码在字典里。
- **修复**：抽到 `const WEAPON_DATA := {...}` 或独立 `.tres` 资源文件。

### G-14 `build_manager.gd` 巨型 if-else 链违背数据驱动
- **文件**：[src/scripts/build_manager.gd](file:///e:/myProject/star-abyss-game/src/scripts/build_manager.gd)（755 行，按首轮摘要：`get_selected_cost()`、`get_selected_label()`、`_instantiate_selected_structure()`、`_refresh_preview_mesh()` 均为 7 分支 match）
- **现象**：7 种建筑的成本、标签、实例化、预览 mesh 散落在多个 match 链中，且常量与 [objective_tracker.gd:5-17](file:///e:/myProject/star-abyss-game/src/scripts/objective_tracker.gd#L5-L17)、[save_manager.gd:8-22](file:///e:/myProject/star-abyss-game/src/scripts/save_manager.gd#L8-L22) 重复定义。
- **修复**：参照 [tech_manager.gd:13-26](file:///e:/myProject/star-abyss-game/src/scripts/tech_manager.gd#L13-L26) 的 `UNLOCK_COSTS` + `LABELS` 字典模式，把 BUILD_DATA 抽到单一数据源（建议新建 `building_data.gd` autoload 或 const）。

### G-15 `combat_hud.gd` 全部 Label 在 `_ready()` 动态创建
- **文件**：[src/scripts/combat_hud.gd:32-122](file:///e:/myProject/star-abyss-game/src/scripts/combat_hud.gd#L32-L122)
- **现象**：13 个 Label 在 `_ready()` 中 `Label.new()` + 硬编码 `position`/`size`/`font_size`，共 90+ 行。
- **影响**：无法在编辑器中可视化调整布局，修改 UI 必须改代码。
- **修复**：迁移到 `combat_hud.tscn` 场景文件，脚本只负责数据绑定。

### G-16 `combat_hud.gd` `_process()` 每帧刷新 10+ HUD 元素
- **文件**：[src/scripts/combat_hud.gd:161-175](file:///e:/myProject/star-abyss-game/src/scripts/combat_hud.gd#L161-L175)
- **现象**：`_process()` 每帧调用 10 个 `_refresh_*()` 函数，即使数据未变。
- **修复**：改为信号驱动（已在 `_on_*` 回调中部分实现），移除 `_process` 或仅在 `_save_status_time_remaining > 0` 时启用。

### G-17 `save_manager.gd` 重复 build_manager 的实例化与标签逻辑
- **文件**：[src/scripts/save_manager.gd:298-366](file:///e:/myProject/star-abyss-game/src/scripts/save_manager.gd#L298-L366)
- **现象**：`_instantiate_structure()`、`_get_structure_build_id()`、`_label_for_build_id()` 三个 match 链与 build_manager 高度重复。
- **修复**：把建筑数据/实例化逻辑收敛到 build_manager 的公共 API（如 `BuildManager.instantiate_by_id(id)`、`BuildManager.label_for_id(id)`），save_manager 调用即可。

### G-18 `objective_tracker.gd` 重复建筑成本常量
- **文件**：[src/scripts/objective_tracker.gd:5-17](file:///e:/myProject/star-abyss-game/src/scripts/objective_tracker.gd#L5-L17)
- **现象**：`TURRET_COST`、`O2_STATION_COST` 等 13 个成本常量与 [build_manager.gd:11-17](file:///e:/myProject/star-abyss-game/src/scripts/build_manager.gd#L11-L17) 完全重复。
- **修复**：与 G-14 一并收敛到统一数据源。

### G-19 多文件重复 `_resource_label()` 实现
- **文件**：
  - [objective_tracker.gd:274-277](file:///e:/myProject/star-abyss-game/src/scripts/objective_tracker.gd#L274-L277) — 仅处理 `void_crystal`
  - [death_drop_manager.gd:154-163](file:///e:/myProject/star-abyss-game/src/scripts/death_drop_manager.gd#L154-L163) — 处理 `void_crystal`/`energy_core`/`oxygen_canister`
  - [resource_scanner.gd:125-134](file:///e:/myProject/star-abyss-game/src/scripts/resource_scanner.gd#L125-L134) — 处理 4 种
  - [combat_hud.gd:6-14](file:///e:/myProject/star-abyss-game/src/scripts/combat_hud.gd#L6-L14) — `INVENTORY_DISPLAY_NAMES` 字典
- **现象**：4 个文件各自维护一套资源显示名映射，规则不一致（scanner 把 `void_crystal` 显示为 "crystal"，death_drop_manager 把 `energy_core` 显示为 "core"，objective_tracker 只转 `void_crystal`）。
- **修复**：抽到统一的 `ResourceLabels` 工具类/autoload。

### G-20 多文件重复 `_flat_distance()` 与 `_direction_label()`
- **文件**：`death_drop_manager.gd`、`signal_log_manager.gd`、`resource_scanner.gd`、`slow_field.gd`、`enemy.gd`、`toolbelt_manager.gd`
- **现象**：6 个文件各自实现 `_flat_distance(a, b)`（忽略 y 轴的距离）和 `_direction_label(from, to)`（N/S/E/W 方向标签），逻辑几乎完全相同，仅 `signal_log_manager` 与 `resource_scanner` 的方向阈值不同（1.0 vs 2.0）。
- **修复**：抽到 `SpatialUtils` 工具类。

### G-21 `zone_manager.gd` 类型注解不一致
- **文件**：[src/scripts/zone_manager.gd:37-51](file:///e:/myProject/star-abyss-game/src/scripts/zone_manager.gd#L37-L51)
- **现象**：`func get_oxygen_multiplier() -> float:` 内部 `var pressure = ...`、`var adaptation = ...`、`var mult = ...` 均未类型注解，与项目其他文件（`var x: float = ...`）风格不一致。
- **修复**：补全类型注解 `var pressure: float = ...`。

### G-22 `zone_manager.gd` 缺少 `_ready()` 初始化与信号联动
- **文件**：[src/scripts/zone_manager.gd](file:///e:/myProject/star-abyss-game/src/scripts/zone_manager.gd)
- **现象**：`adaptations` 字典定义了 4 个区域的适应等级，`ADAPTATION_BONUSES` 定义了 Lv4 的速度加成与免疫，但全文没有 `_ready()`，没有连接任何信号，`get_speed_bonus()` 也没在 [player.gd](file:///e:/myProject/star-abyss-game/src/scripts/player.gd) 中被调用。
- **影响**：区域适应系统实际上是"死代码"——`adaptations` 永远保持初始 0，`ADAPTATION_BONUSES` 永不生效，玩家进入 COLD/HEAT/GRAVITY 区域不会有任何加成解锁（虽然 [serum_ui.gd](file:///e:/myProject/star-abyss-game/src/scripts/serum_ui.gd) 能修改 `adaptations`，但效果没接到 player）。
- **修复**：在 player.gd 的速度计算中接入 `ZoneManager.get_speed_bonus()`，并验证 `oxygen_multiplier` 是否真的影响氧气消耗。

### G-23 `zone_trigger.gd` 函数签名无类型注解
- **文件**：[src/scripts/zone_trigger.gd:5-11](file:///e:/myProject/star-abyss-game/src/scripts/zone_trigger.gd#L5-L11)
- **现象**：`func _ready():`、`func _on_body_entered(body):` 缺少返回类型与参数类型，与项目风格不一致。
- **修复**：改为 `func _ready() -> void:`、`func _on_body_entered(body: Node3D) -> void:`。

### G-24 `o2_station.gd` 每帧调用 `get_first_node_in_group("player")`
- **文件**：[src/scripts/o2_station.gd:17-29](file:///e:/myProject/star-abyss-game/src/scripts/o2_station.gd#L17-L29)
- **现象**：`_process()` 每帧都 `get_tree().get_first_node_in_group("player")`，再去算距离判断是否在范围内。
- **修复**：用 Area3D 检测玩家进入/离开，仅在玩家在范围内时执行充氧逻辑。

### G-25 `slow_field.gd` 每帧遍历全部敌人
- **文件**：[src/scripts/slow_field.gd:19-34](file:///e:/myProject/star-abyss-game/src/scripts/slow_field.gd#L19-L34)
- **现象**：`_process()` 每帧遍历 `get_nodes_in_group("enemies")`，对每个敌人算距离判断是否在 RANGE 内。
- **修复**：用 Area3D + `body_entered`/`body_exited` 信号驱动 `apply_slow`/`remove_slow`。

### G-26 `death_drop_manager.gd:113` 多余缩进
- **文件**：[src/scripts/death_drop_manager.gd:110-113](file:///e:/myProject/star-abyss-game/src/scripts/death_drop_manager.gd#L110-L113)
- **现象**：
  ```
  for drop in get_tree().get_nodes_in_group("death_drops"):
      if drop and is_instance_valid(drop):
              drop.queue_free()    # ← 多了一层缩进
  ```
- **修复**：删除多余的制表符，对齐到 `if` 体内。

### G-27 `player_projectile.gd` `_on_area_entered` 空函数
- **文件**：[src/scripts/player_projectile.gd:49-50](file:///e:/myProject/star-abyss-game/src/scripts/player_projectile.gd#L49-L50)
- **现象**：`area_entered` 信号连接到 `_on_area_entered(_area: Area3D): pass`，函数体为空。
- **修复**：若无需处理 area 碰撞，删除信号连接与函数；若需要（例如与对方投射物相撞），补全逻辑。

### G-28 `forge_ui.gd` 调用 weapon_controller 的私有方法
- **文件**：[src/scripts/forge_ui.gd:140, 223](file:///e:/myProject/star-abyss-game/src/scripts/forge_ui.gd#L140)
- **现象**：`weapon_controller._get_weapon_quality(selected_weapon)` 访问带下划线前缀的"私有"方法。
- **修复**：在 [weapon_controller.gd:108](file:///e:/myProject/star-abyss-game/src/scripts/weapon_controller.gd#L108) 把 `_get_weapon_quality` 重命名为 `get_weapon_quality`（去掉下划线），同时更新所有调用点。

### G-29 `research_station.gd` 重复检查 `has_resources`
- **文件**：[src/scripts/research_station.gd:18-29](file:///e:/myProject/star-abyss-game/src/scripts/research_station.gd#L18-L29)
- **现象**：`_process()` 第 19 行先 `if not InventoryManager.has_resources({"energy": ENERGY_COST}): return`，进入 while 循环后第 24 行又检查一次同样的条件。
- **修复**：删除循环内的二次检查（除非担心并发修改，但 GDScript 单线程不会发生）。

### G-30 `signal_log_manager.gd` 读档时立即触发 extraction 完成
- **文件**：[src/scripts/signal_log_manager.gd:91-94](file:///e:/myProject/star-abyss-game/src/scripts/signal_log_manager.gd#L91-L94)
- **现象**：`apply_save_data()` 中若 `extraction_holdout_active=true` 且 `extraction_time_remaining≈0`，会立即调用 `_complete_extraction_holdout()` 标记游戏胜利。
- **影响**：玩家在撤离倒计时刚好归零的瞬间存档，读档后会直接判定胜利；若存档时倒计时为 0.01，读档后下一帧即归零完成，体验突兀。
- **修复**：保存时若倒计时已 ≤ 0 应当先完成 holdout 再存档；读档时若发现此状态视为已完成即可，不再触发额外流程。

### G-31 `signal_beacon.gd` 读档首帧可能误触发 transmit
- **文件**：[src/scripts/signal_beacon.gd](file:///e:/myProject/star-abyss-game/src/scripts/signal_beacon.gd) + [save_manager.gd:221-247](file:///e:/myProject/star-abyss-game/src/scripts/save_manager.gd#L221-L247)
- **现象**：save_manager 在 `add_child(structure)` 后才通过 `set("signal_progress", ...)`、`set("signal_power_timer", ...)` 恢复状态。`add_child` 同步触发 `_ready()` → `set_process(true)`，下一帧 `_process` 会用默认的 `signal_power_timer=0` 开始累加。若存档时 `signal_power_timer` 接近 `SIGNAL_INTERVAL`，恢复后到下一帧之间已可能触发 `_try_transmit_signal()` 多消耗 1 点 energy。
- **修复**：在 signal_beacon 增加 `var _restored: bool = false`，`_process` 在 `_restored=false` 时直接 return；save_manager 在 `set()` 完成后调用 `structure.call("_mark_restored")`。

### G-32 `resource_node.gd` VFX 异步释放可能访问已释放节点
- **文件**：[src/scripts/resource_node.gd:280-314](file:///e:/myProject/star-abyss-game/src/scripts/resource_node.gd#L280-L314)
- **现象**：`_spawn_pickup_vfx()` 在 `queue_free()` 之前创建 GPUParticles3D，用 `await get_tree().create_timer(0.6).timeout` 后再 `particles.queue_free()`。但 `collect()` 中 `queue_free()` 在 `_spawn_pickup_vfx()` 之后立即调用，0.6 秒后 resource_node 自身已被释放，`if is_instance_valid(particles)` 检查的是 particles 不是 self，所以勉强能用，但若场景切换则 current_scene 已变，particles 父节点失效。
- **修复**：把 VFX 挂到独立的临时 Node 上，或用 `particles.finished` 信号自动释放。

---

## 🟢 建议优化（可选）

### P-01 `teleport_manager.gd` 功能未接入
- **文件**：[src/scripts/teleport_manager.gd](file:///e:/myProject/star-abyss-game/src/scripts/teleport_manager.gd)
- **现象**：虽然 [main.tscn:233](file:///e:/myProject/star-abyss-game/src/scenes/main.tscn#L233) 挂载了该节点，但全文搜索未发现任何地方调用 `register_beacon`/`teleport_to_base`/`teleport_to_beacon`；`beacons` 字典永远为空。`teleport` 输入动作（[project.godot:116](file:///e:/myProject/star-abyss-game/src/project.godot#L116)）也无监听者。
- **建议**：要么补全传送系统（玩家按 T 传回基地/已放置信标），要么删除该文件与 main.tscn 中的节点。

### P-02 `oxygen_ui.gd`/`resource_hud.gd`/`weapon_hud.gd`/`serum_ui.gd` 与 combat_hud 职责重叠
- **文件**：见 [main.tscn:115-231](file:///e:/myProject/star-abyss-game/src/scenes/main.tscn#L115-L231)
- **现象**：
  - `resource_hud.gd` 在右上角显示库存，[combat_hud.gd:46-51](file:///e:/myProject/star-abyss-game/src/scripts/combat_hud.gd#L46-L51) 的 `_inventory_label` 在左侧也显示库存，两套数据来源相同但布局独立。
  - `oxygen_ui.gd` 的 GameOverPanel 与 combat_hud 都监听玩家状态。
  - `weapon_hud.gd` 显示武器与弹药，与 combat_hud 的 `_toolbelt_label` 部分重叠。
- **建议**：统一 HUD 架构 — 要么把所有 UI 收敛到 combat_hud.gd + 一个 combat_hud.tscn，要么明确各 UI 的职责边界（如 OxygenUI 只管氧气条与死亡面板，WeaponHUD 只管武器，Inventory 完全交给 combat_hud）。

### P-03 `player_projectile.gd` WEAPON_COLORS 与 weapon_controller 重复
- **文件**：[src/scripts/player_projectile.gd:9-15](file:///e:/myProject/star-abyss-game/src/scripts/player_projectile.gd#L9-L15)
- **现象**：5 种武器的颜色字典硬编码在投射物脚本里，与 [weapon_controller.gd](file:///e:/myProject/star-abyss-game/src/scripts/weapon_controller.gd) 的武器数据分离。
- **建议**：把颜色纳入 G-13 提议的统一 WEAPON_DATA。

### P-04 `player.gd:241-243` 重复地形高度常量
- **文件**：[src/scripts/player.gd:241-243](file:///e:/myProject/star-abyss-game/src/scripts/player.gd#L241-L243)（按首轮摘要）
- **现象**：player.gd 内有 `TERRAIN_MIN_HEIGHT`/`TERRAIN_MAX_HEIGHT` 常量，与 [world_generator.gd](file:///e:/myProject/star-abyss-game/src/scripts/world_generator.gd) 的 -5.0/15.0 重复。
- **建议**：在 WorldGenerator 暴露 `const TERRAIN_MIN_HEIGHT`/`const TERRAIN_MAX_HEIGHT`，player 与 aim_targeting 引用之。

### P-05 `buried_resource.gd` `depth` 属性仅用于显示
- **文件**：[src/scripts/buried_resource.gd:6](file:///e:/myProject/star-abyss-game/src/scripts/buried_resource.gd#L6)
- **现象**：`@export var depth: float = 1.2` 仅在 `get_scan_hint()` 中作为"depth %.1fm"显示，不影响 `harvest_once()` 的挖掘次数（由 `dig_required` 决定）。
- **建议**：要么让 `depth` 真正影响挖掘时长（如 `dig_required = ceil(depth * 2)`），要么删除该属性避免误导。

### P-06 `resource_hud.gd` 与 `combat_hud.gd` 重复库存显示常量
- **文件**：[src/scripts/resource_hud.gd:3-12](file:///e:/myProject/star-abyss-game/src/scripts/resource_hud.gd#L3-L12) vs [src/scripts/combat_hud.gd:5-14](file:///e:/myProject/star-abyss-game/src/scripts/combat_hud.gd#L5-L14)
- **现象**：两文件都定义了完全相同的 `DISPLAY_ORDER`/`DISPLAY_NAMES` 常量。
- **建议**：抽到共享 const（与 G-19 一并处理）。

### P-07 `base_pod.gd` 注释风格不统一
- **文件**：[src/scripts/base_pod.gd:2-3, 8-9](file:///e:/myProject/star-abyss-game/src/scripts/base_pod.gd#L2-L3)
- **现象**：使用 `##` 文档注释 + `#` 普通注释混用，且部分常量在 `var` 区而非 `const` 区。
- **建议**：统一为 `#` 普通注释（项目其他文件多用 `#`）。

### P-08 `serum_recipes.gd` 与 `zone_manager.gd` 重复区域名称
- **文件**：[src/scripts/serum_recipes.gd:22](file:///e:/myProject/star-abyss-game/src/scripts/serum_recipes.gd#L22) vs [src/scripts/zone_manager.gd:30-35](file:///e:/myProject/star-abyss-game/src/scripts/zone_manager.gd#L30-L35)
- **现象**：两文件都定义了 `ZONE_NAMES`/`ZONE_ICONS`，内容相同。
- **建议**：以 zone_manager 为单一数据源，serum_recipes 引用之。

---

## 修复优先级建议

**第一批（🔴 严重，立即修复）**：S-01 ~ S-06
- S-01、S-02、S-05 是明确的运行时 bug，直接影响玩法
- S-03 是数据完整性风险
- S-04 与 S-02 联动需一起决策
- S-06 影响死亡重置体验

**第二批（🟡 高频一般问题）**：G-01 ~ G-09、G-26、G-27
- 都是局部小改、低风险，可快速清理
- 主要是 debug print、preload 改造、俄文注释、未使用变量

**第三批（🟡 架构性问题）**：G-14、G-17、G-18、G-19、G-20
- 涉及多文件重构（建筑数据收敛、工具类抽取）
- 建议在第二批完成后统一规划

**第四批（🟡 性能优化）**：G-11、G-16、G-24、G-25
- 主要是 _process 优化、信号驱动改造
- 可逐文件单独处理

**第五批（🟢 建议优化）**：P-01 ~ P-08
- 可选改进，非阻塞
- 建议结合实际玩法需求决定是否实施

---

## 附：本次审查统计

| 类别 | 数量 |
|------|------|
| 🔴 严重 | 6 |
| 🟡 一般 | 32 |
| 🟢 建议 | 8 |
| **合计** | **46** |

相比首轮 18 项，本轮新增 28 项，主要来自：
- 第三组脚本（signal/zone/oxygen/death_drop/toolbelt/scanner/resource/projectile/structure）的深度阅读
- 场景文件 main.tscn 与 project.godot 的交叉验证
- 对 autoload 实际使用情况的核对
- 对函数签名一致性的逐处比对（如 S-01 apply_slow）
