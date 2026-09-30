# R3 原生战斗接口契约

本文件由 `NativeMain` 集成维护。各模块仍保留 R2 入口以便旧验证脚本、存档和六公里场景运行。R3 的权威时间、灵息、冷却、命中与存档由 Main/Ascension 处理；动作只报告姿态与骨点，特效只显示已发生的事件，敌人只管理自身状态与攻击请求。

## 输入与技能

| 输入 | 地面 | 空中 |
| --- | --- | --- |
| 左键 | 原有左直拳、右直拳、上挑踢循环 | 同一套近战循环 |
| R | 施放当前境界武技 | 施放当前境界武技 |
| Space | 只由 Player 处理地面跳跃 | 不触发技能或二段起飞 |

境界决定 R 招式：R4 `cast_fist` 右拳气劲、R5 `cast_palm` 左掌冲波、R6/R7 `cast_sweep` 横扫、R8 `cast_cleave` 下劈、R9 `cast_skyfall` 空中压掌。地面和空中均可起手，动作模块分别用常规与 `air_` 片段；不要求飞起来才能施法。Space 与 R 是互不串线的独立输入。蓄力和释放不能因单个物理帧的落地抖动重复执行。境界原有伤害、范围与存档规则保留。HUD 写明本次将发出的招式、灵息和冷却，给玩家预判的机会。F2 把玩家送到裂翼岭；F3 重置试玩对手并在存档中标记禁止重复掉落；F6 仍是临时试玩境界。

## Main → Player/动作

R3 新入口为 `play_combat_action(profile: Dictionary) -> bool`。现有 `play_attack()`/`play_air_cast()` 保留转接。成功后 Player 增加单调 `combat_serial`，供 Main 在释放帧核对；受伤、瞬移、上车、死亡使此 serial 失效。`combat_socket_transform_world(socket: String) -> Transform3D` 转发当前可见骨架的 `hand_l`、`hand_r`、`foot_r` 世界变换；Main 取其 `origin` 作为当帧施法源点。无效变换不能用角色中心虚构施法源。

动作模块提供静态 `cast_profile(realm: int, variant: String = "") -> Dictionary`，含 `action`、`windup`、`release_time`、`duration`、`recovery`、`socket`、`gesture`、`release_normalized`。R4–R9 的既有蓄力时间分别为 0.50、0.42、0.65、1.80、2.20 秒；R7 沿用 R6。`release_time` 必须与 Main 权威释放时刻相同。所有招式从起手 `start`、蓄力 `windup`、唯一释放 `release`、收势 `recovery`、中断 `cancel` 经过。Main 只在物理帧中让计时器跨越 `release_time` 时结算一次。动作模块用 `socket_transform_world(socket: String) -> Transform3D` 读取当前骨点，不 seek、不改变伤害。Player/动作中的骨点必须在该帧已更新；动作状态可用 `combat_serial` 和 `combat_action_id` 查询。动作资源未交付前，Main 不能用球体或旧摆姿冒充新动作完成。

需要飞行会话在 `native_player.gd` 实现以上 R3 入口和骨点转发，并使 Space 与 R 互不触发；动作会话在 `native_motion_r2.gd` 或自己的 R3 适配模块提供五种境界姿态及释放点。若实际方法名需要调整，请先在本文件更新再通知集成会话。

## Main → VFX

VFX R3 为一个实例一招：`begin_cast(realm: int, profile: Dictionary, socket: Transform3D, target: Vector3)`、`follow_socket(socket: Transform3D)`、`release(socket: Transform3D, target: Vector3, travel_seconds: float = 0.12)`、`impact(at: Vector3, normal: Vector3 = Vector3.UP, hit: bool = true)`、`cancel()`。命中传 `hit=true` 显示目标爆散；落空传 `hit=false` 在 85 毫秒内消散且不显示命中亮斑。由 VFX 自身 `_physics_process(delta)` 用真实物理步推进；Main 仅发送这些事件，不手动调用 `advance()`。

`profile` 取自上述 `cast_profile`，`socket` 是骨点世界变换，`target` 是世界目标点。不同招式使用不同的、从概念图出发制作的资产；特效没有物理伤害权威。R2 `spawn_air_cast` 仅作兼容回退。VFX 会话只写 `native_vfx_r3.gd` 与其独立资产；Main/Ascension 实例化与接线。

## Main ↔ 敌人

敌人保持现有 `receive_hit(damage, hitstop)`、`body_contact_distance(point)`、`defeated`、`snapshot()/restore()` 兼容。新入口为 `receive_combat_hit(hit: Dictionary) -> Dictionary`，字段 `action_id`、`damage`、`stagger`、`guard_break`、`knockback: Vector3`、`hitstop`、`source: Vector3`；返回 `landed`、`damage_applied`、`interrupted`、`defeated`。敌人发 `enemy_attack_requested(event: Dictionary)`，包含 `attack_id`、`origin`、`direction`、`reach`、`radius`、`damage`、`stagger`、`guard_break`、`knockback`、`serial`；Main 在请求帧检查玩家真实胶囊距离、朝向、遮挡、格挡，再调用 Player 的伤害接口。敌人原 `defeated` 信号与掉落键 H 不变。

R3 另有普通地面敌人 `NativeEnemyR3`，精英裂翼兽保持 `NativeRiftwing` 和原 `riftwing` 存档键。Main 管理 `enemies` 数组，为普通敌人加载既有可用 GLB、接同一套命中与格挡信号，并把普通敌人状态写到可选 `enemy_r3` 存档键。旧档没有该键时按固定家园点生成，原调查、载具、玩家和精英兽数据不迁移。敌人攻击信号额外携 `source_id`、`enemy` 实例以便定位，Main 结算后调用 `acknowledge_attack_result(serial, landed, blocked)` 让敌人进入对应命中停顿或被挡收势。

拳脚用骨点到敌人身体的距离；境界武技从当前骨点沿准星方向发出，R6/R7 用水平弧域、R8/R9 用竖向裂隙判定。所有招式释放时重读位置、面向、骨点及遮挡；按键时的准星仅用于蓄力预览。挡住的攻击无伤害与命中停顿。中断后不得重复结算；新技能仅在成功进入动作时付费，打断不返还费用。格挡按原玩家系数承伤，破防事件使格挡失效并短暂硬直。

## 数据与验收

技能表在 Main 中按 R4/R5/R6/R8/R9 分级；R7 沿用 R6 基础型但强化数值。每招包含 `windup`、`recovery`、`cost`、`cooldown`、`reach`、`radius`、`damage`、`stagger`。Main 维护技能冷却，写入原生存档的可选 `combat` 字段；旧档缺字段时冷却归零，生命、境界、调查、车和怪物位置保持原样。

验证必须使用 Godot 实际 `physics_frame`，记录每帧真实 `delta` 与攻击/释放/命中/取消事件。自动脚本测一次性命中、动作骨点、遮挡、灵息和冷却、格挡与打断、存档重开；实际窗口键鼠测 R/Space、准星与手部施法源、地空命中、HUD 中文完整显示、F2 对打和 F5 重开。截帧只作为视觉证据，不能代替手感结论。
