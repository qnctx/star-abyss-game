# 代码审查（唯一维护文档）

> 最后审查：2026-07-10  
> 审查基线：`main` 当前工作区（含未提交的地形/玩家物理改动）  
> 当前结论：**阻塞**。项目存在脚本编译错误，不能进入运行时测试。

本文档是仓库中唯一维护的代码审查记录。只保留当前仍需处理且能验证的问题；已修复问题由 Git 历史保存。

## 审查结论

| ID | 优先级 | 状态 | 位置 | 结论 |
|---|---|---|---|---|
| R-001 | P0 | 待修复 | `player.gd:152,176` | 同一作用域重复声明 `ground_y`，Godot 报 Parse Error。 |
| R-002 | P0 | 待修复 | `world_generator.gd:281-285` | `_build_collision_shape()` 已删除但仍被调用，autoload 无法编译。 |
| R-003 | P0 | 待修复 | `world_generator.gd:309-322` | 每格只写入 5 个索引，地形三角形索引损坏。 |
| R-004 | P1 | 待决策 | `world_generator.gd:272-369` | 创建 10,000 个凸碰撞形状后又禁用碰撞，同时仍追加旧形状。 |
| R-005 | P1 | 待修复 | `test_physics.gd` | 未接入测试入口、没有断言，且重复调用玩家物理更新。 |
| R-006 | P2 | 技术债 | 炮塔、减速场、氧气站 | 多个 `_process()` 每帧遍历组或重新查询玩家。 |
| R-007 | P2 | 技术债 | 建造、存档、目标系统 | 建筑成本、标签、实例化规则仍有多份数据源。 |
| R-008 | P2 | 技术债 | 世界生成、存档、建造系统 | 运行路径仍包含大量调试 `print()`。 |

## 关键问题

### R-001 / R-002：当前项目不能编译

`player.gd` 已声明 `ground_y`，新增 safety net 又在同一函数作用域声明同名变量。`world_generator.gd` 用新方法替换了 `_build_collision_shape()` 的定义，却保留旧调用。由于 WorldGenerator 是 autoload，错误会连带影响依赖脚本。

### R-003：地形网格索引损坏

100 × 100 个格子应生成 20,000 个三角形、60,000 个索引。当前每格只有 5 个索引，总数变成 50,000，且第一个格子起三角形边界就错位。修复后应增加最终索引数断言。

### R-004：碰撞策略没有收束

当前同时采用“玩家按高度函数贴地”“每格一个凸碰撞形状”“旧整网格碰撞”三种策略，但 StaticBody3D 的碰撞层和掩码又都是 `0`。建议只保留一种主策略；不要为禁用状态创建 10,000 个形状。若保留物理碰撞，先用小规模基准验证生成耗时、内存、坡面接触和卡边问题。

### R-005：物理回归测试无效

`test_physics.gd` 没有被项目或测试入口引用，也没有 pass/fail 断言。它在引擎处理帧后手动再调用 `_physics_process()`，造成双重更新；预设的 Z 速度也会被玩家输入逻辑覆盖。

应把用例并入 `src/test_runner.gd`，至少断言脚本可加载、索引数为 60,000、坡地/跳跃落地后的高度正确、没有穿地或瞬移。

## 验证记录

执行：

```bash
/Applications/Godot.app/Contents/MacOS/Godot --headless --path src --editor --quit
```

Godot 4.6.2 报告：

```text
Parse Error: Function "_build_collision_shape()" not found in base self.
Parse Error: There is already a variable named "ground_y" declared in this scope.
```

注意：命令出现脚本错误时仍返回 `0`。自动化不能只看退出码，必须把 `SCRIPT ERROR`、`Parse Error`、`Compile Error` 视为失败。完整测试暂未执行，因为编译门禁已经失败。

## 建议顺序

1. 修复 R-001、R-002，恢复全项目脚本加载。
2. 修复 R-003，并增加网格索引断言。
3. 对 R-004 选择唯一碰撞策略。
4. 将 R-005 改成可重复、带断言的测试。
5. 运行编辑器加载、`test_runner.gd`、`test_standalone.gd` 和手工移动测试。
6. 分别安排 R-006～R-008，避免混入地形修复。
