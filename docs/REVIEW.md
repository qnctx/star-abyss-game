# 代码审查（唯一维护文档）

> 最后审查：2026-07-10  
> 审查基线：`main` 当前工作区
> 范围：HTML5 playable v3；Godot 功能源码本轮未修改

## 当前结论

浏览器原型已从单文件战斗演示改为可离线运行的 v3 闭环。已确认并修复旧原型中的缺氧无限死亡、撞击也发击杀奖励、建造点击同时射击、无固定步长、无存档/胜负/自动化接口等问题。

`npm test` 当前 9/9 通过。Playwright E2E 已编写，但本轮未安装开发依赖，因此不宣称浏览器 E2E、浏览器矩阵或 30–45 分钟真人长局已经通过。

## HTML 已验证项

| ID | 状态 | 结论 |
|---|---|---|
| H-001 | 已修复 | 复活恢复 90 秒氧气和 4 秒无敌，不再从 0 氧气循环死亡。 |
| H-002 | 已修复 | 只有 `player` / `turret` 合法击杀发奖励；撞基地/结构不发奖励。 |
| H-003 | 已修复 | Weapon/Harvester/Scanner/Build/Repair 左键主操作互斥。 |
| H-004 | 已修复 | 使用固定 1/60 秒步长，累计时间封顶 0.25 秒，失焦清输入。 |
| H-005 | 已实现 | 大世界、四区域、七建筑、血清、信号缓存、180 秒坚守及胜负重开。 |
| H-006 | 已实现 | `localStorage` schema 3 单槽存档和受控测试接口。 |
| H-007 | 已验证 | Node 逻辑测试覆盖关键纯规则与存档边界，9/9 通过。 |
| H-008 | 待执行 | Playwright E2E、Chrome/Edge/Firefox smoke、多分辨率截图检查。 |
| H-009 | 待执行 | 固定种子 30–45 分钟真人完整通关及连续 45 分钟稳定性。 |

## Godot 状态

本任务明确不修改 Godot 功能源码，因此没有重新运行或修复 Godot 门禁。此前记录的脚本加载与地形相关问题不能据本轮 HTML 工作判定已解决；需要单独在 Godot 4.6.2 环境运行编辑器加载、`src/test_runner.gd`、`src/test_standalone.gd` 和主场景 smoke，并把日志中的 `SCRIPT ERROR`、`Parse Error`、`Compile Error` 视为失败。

## 仍存在的架构债

- Godot 建筑成本、标签和实例化规则仍分散在建造、科技和各建筑脚本中；HTML 已集中到 `playable/js/config.js`，Godot 尚未同步。
- Godot 炮塔、减速场、氧气站等仍有每帧 group 查询路径。
- Godot 世界生成、存档和建造路径仍包含诊断日志。
- HTML 敌人使用直接寻目标移动和圆形距离判断，尚无障碍寻路或空间索引；这是规格原型的已知限制。

## 下一验证顺序

1. 安装开发依赖并运行 `npm run test:e2e`，修复所有页面异常和 viewport 失败。
2. 执行固定种子完整通关、失败后重开、Signal/Extraction/Death Drop 存档边界手测。
3. 在 Chrome、Edge、Firefox 验证 `file://` 双击启动和断网首夜。
4. 独立恢复 Godot 编译门禁，再按 `docs/HTML_GODOT_CONTRACT.md` 同步玩家可观察行为。
