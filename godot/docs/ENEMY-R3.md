# R3 野怪对打切片

负责人仅改 `native_riftwing.gd`、`native_enemy_r3.gd`、`assets/enemy-r3/` 和本文/自己的测试。Main 的接入与 `r3-combat-contract.md` 由武技会话维护。原六公里场景、C2、车辆和旧 `riftwing` 存档键保持。

## 编排依据与范围

先研究官方创作者资料：

- [PlatinumGames · Rooting for the Enemy](https://www.platinumgames.com/official-blog/article/1349)：攻击预兆留给玩家决策时间，起手后提交攻击，难度要通过试玩校准。
- [PlatinumGames · Figuring Out Damage Motion](https://www.platinumgames.com/official-blog/article/6647)：不同攻击应有不同受击反馈；动画／数值验证不能替代实际控制体验。
- [Capcom · Animating the Monsters of Sunbreak](https://news.capcomusa.com/2023/04/07/animating-the-monsters-of-sunbreak/)：按玩法设计动作，在引擎内联合攻击与特效迭代；玩家能从起手看出动作与反击时机。

本项目采用上述可读性原则，沿用原创裂翼兽和裂脊兽形象，不复制资料中的 IP 造型。当前新图批次未生成；总控确认可用已有生成图继续本地 Blender 制作。已从匹配原兽的两份旧生成图出发，交付同源精英/地面变体、七招动作和真实肩甲碎片投射物；付费生成调用为零。参考图 SHA、来源与可编辑源见 `assets/enemy-r3/manifest.json` 和该目录 README。AI 会检查动作／飞梭资源存在性，不允许无资源的隐形招式。

## 实体与接口

`NativeRiftwing` 继承 `NativeEnemyR3`，保留 `MAX_HP=311040`、HOME 坐标、`receive_hit`、`body_contact_distance`、`snapshot/restore`、`defeated`、`loot_left`。普通怪可 `NativeEnemyR3.new()`，入树后添加 Model/加载 `assets/enemy-r3/rift-prowler-r3.glb`，调用 `configure_variant("ground", Vector3(1338,0,-1020))` 再 `setup(world,player)`。精英使用 `riftwing-r3.glb`。普通怪生命 86400，掉落 1；旧精英掉落 2。推荐出生点相距约 33.5 米，避免把两只兽挤在 F2 落点上。

新接口遵守契约：`receive_combat_hit(Dictionary)` 返回 landed/damage_applied/interrupted/defeated；`enemy_attack_requested(Dictionary)` 含 enemy/source_id/attack_id/serial/origin/direction/reach/radius/damage/stagger/guard_break/knockback。origin 来自真实骨骼。Main 判定后调用 `acknowledge_attack_result(serial,landed,blocked=false)`。每次攻击只有一次伤害请求；投射物在真实到达玩家附近后请求，不能出生即命中。

`enemy_skill_event` 提供 start/release/recovery/end/cancel；`enemy_defeated` 提供身份、位置和掉落。`get_combat_snapshot()` 暴露 phase/tactic/clock/attack_elapsed/serial/cooldowns/locked_direction/perceived/returning/delta/physics_time 等供独立验收。时间来自正常 `_physics_process(delta)`，动画也在相同帧手动推进，局部停顿不暂停世界。

## 行为与反制

感知每 0.22 秒采样位置和世界遮挡；闲置 42 米、已警觉 65 米，丢失目标 4.5 秒后返巢。AI 不读取按键、格挡或玩家 CD。距巢 112 米、玩家距巢 130 米、垂直超 72 米或玩家死亡触发脱战；精英先降落再返巢，不恢复已造成的伤害。近距离撤步、中距离追击、攻击后绕侧，选择方向持久化避免堵墙抖动。每段位移不超过 0.35 米，并检查世界边界/高度和 Godot 实体碰撞；避障为局部绕障，不声称具备全地图导航网格。

| 技能 | 起手 / 有效 / 收势（秒） | CD | 反制 |
| --- | --- | --- | --- |
| 前爪 | .48 / .14 / .82 | 2.1 | 侧闪、格挡、起手打断 |
| 突爪 | .82 / .36 / 1.18 | 5.2 | 锁定后横移；落空收势长 |
| 尾扫 | .72 / .22 / 1.0 | 4.2 | 离开尾部轨迹或起手打断 |
| 挑空 | .86 / .30 / 1.18 | 6.0 | 低空横移；落地收势反击 |
| 裂晶飞梭 | 1.05 / .12 / 1.05 | 5.8 | 固定方向，23米/秒，掩体与侧移 |
| 翼扫 | .65 / .20 / 1.1 | 3.4 | 退出近身翼缘，格挡 |
| 俯冲 | .95 / .50 / 1.40 | 6.5 | 提前侧移；破防但可起手打断 |

普通怪仅地面移动，可跳跃挑空但不持续飞行；精英追踪实际目标高度，起飞有 1.2 秒可见展开，玩家落地后俯冲或着陆。投射物有距离/寿命与遮挡销毁，死亡清除未命中投射物。伤害无无敌读输入，击退采用碰撞分段，不穿墙。

## 验证状态与具体试玩步骤

在 Godot 4.6.2 的真实 OpenGL/Intel UHD 窗口渲染并检查 15 张起手/接触对照图，见 `reports/enemy-r3/`。原/R3/无翼体的 Body AABB、变换和 43275 个顶点数完全一致，见 `asset-audit.json`。自主 AI 的 14 项真实物理回归与七招各自的唯一接触/真实 Main 伤害接口合计 **28/28 通过**，记录在 `physics-report.json`。翼扫专项曾发现局部轴把翼根抬高的错误；改成向前下方发力并重导模型后，真实同高度接触通过，没有扩大命中半径。

独立封版证据见 [FINAL-REPORT.md](../reports/r3-independent/FINAL-REPORT.md) 与 `FINAL-MANIFEST.json`：UTC 2026-09-27 13:49:47 的完整主场景长链为 **2090 个真实物理帧、29/29 程序断言通过**，包括普通兽击杀 H+1/保存重开、5米接近受击、格挡1050/正常4200、空中飞梭命中与 landing→ground。最终同一 Player/Motion/GLB 的首拳三距离验证为2.0米/2.3米命中、2.6米落空，真实墙阻挡踏进；未扩大敌人包围盒。随后 Main/Ascension/VFX 区分空招/真命中的小改，于13:55:22另以300帧完整场景定向验证 **10/10**。两轮来源 SHA 按最终清单分别对应，不拼成同一版本。此前24/24或28/29仅属历史阶段。

独立者保留一次缺少 C 按下记录的停高未归因异常；最终带 Cdown、鼠标捕获、支撑和碰撞观测的同版本长链正常下降，不能据此猜测旧异常原因。开发侧七招几何专项28/28不等于独立者已逐招验完所有技能。真人键鼠手感、独立正常速度视频与所有招式的独立专项均未宣称完成；局部避障范围也保持不变。

自动复验：`Godot...console.exe --headless --path godot --script res://tests/native_enemy_r3_verify.gd`。测试使用独立档位、真实 `physics_frame`、引擎实际 `delta`；不手动调用敌人 `_physics_process` 或按固定步长推进。受击目标可被固定以复现几何边界，不冒充真人试玩。

1. **F2 传送到裂翼岭**，不重置敌人。需要重开对打时，先下车再按 **F3 重置两只试玩对手并返回裂翼岭**；F3 不是选择普通怪。重置后再次击杀不重复产出掉落。原地读起手，右键格挡前爪，再横移让攻击落空；收势中左键／R 反击。普通地面兽位于 `(1338,-1020)`，需自行接近。
2. 拉开到 5–8 米看突进，9–29 米看飞梭，横移和岩体遮挡应有效；绕背到约2米看尾部反击。
3. G 飞到约 5–15 米，精英展开翅膀追高；近身双方攻击，C 降落后观察俯冲／落地。普通怪不悬空追随。
4. 离巢约 130 米再返回，敌人应返巢且保留伤害；正常击杀按 H 拾取，F5 后重开不能重新刷掉落。另用 F3 重置两兽后复测，训练击杀应无可重复拾取掉落。
5. 自动验证必须记录真实 physics_frame 和收到的 delta；脚本结果不表述为已经实际试玩手感通过。
