# 野怪坡面与战斗垂直逻辑修复

日期：2026-09-16。范围：cb21 候选源码；本任务未发布、未覆盖正式工作树。

## 已修复

- `expedition-runtime/index.mjs` 的战斗 body 原来无条件用地面高度覆盖玩家真实 y。现在经 `rules.mjs` 的 combatBody 保留有限的真实脚底 y，再加 1m 身体中心；没有 y 的旧野怪状态仍从共享地形取得支撑高度。实际两处敌人起手与命中路径均使用相同身体坐标。
- `creature-ai.mjs` 起手、`rules.mjs` 命中按三维距离计攻击范围，同时维持原有小于 2m 的垂直差条件、朝向与视线条件。没有 y 的旧单元/API 调用继续按平面计算。原先玩家站在 3m 高台可被当成地面目标，现在双方不会越过垂直限制互击；2.3m 水平加 1.2m 高差也不能假装处于 2.5m 范围内。
- `expedition-world/queries.mjs` 原来每一小步只禁止高度差超过 0.2m，因此 0.065m 短步能通过 56.3° 斜坡，长步却不能。现在逐段限制 rise/run <= 1（45°），上坡和下坡保持同一坡度判断；缺失/非有限地形不再提供可站立支撑。

## 验证

1. `node --test playable/tests/slope-creature-audit.test.mjs playable/tests/creature-ai.test.mjs`：15/15 PASS。新增测试覆盖真实身体高度、三维斜向攻击距离、旧 API、遮挡、0.001–5m 长短步上下陡坡一致、26.6° 可行走坡面与共享支撑高度、NaN 失败关闭。
2. `node --test playable/tests/physical-world.test.js playable/tests/d3-combat.test.js playable/tests/d3-session.test.js playable/tests/world-director.test.js`：65/65 PASS。原物理世界、战斗持久化、外勤记录和生成规则未出现回归。

这里的坡面测试调用真实 createWorldQueries 和 layout 地形扩展接口，注入确定性斜坡以隔离帧长问题；不是浏览器原生地形路线验收。未把测试通过解释为全游戏物理完成。

## 审计边界及后续风险

- 野怪已有真实 GLB 骨骼模型（43,002 顶点 / 35,967 三角形 / 20 骨），`creature-asset.mjs` 接入真实资源，`creature-rig.mjs` 使用四足 IK 与变形后脚掌顶点支撑；不是二维贴图。本轮没有改模型，不触发新增模型概念图流程。
- 野怪位置依然只保存 XZ，并贴合原盆地地形；活体四足 IK 不等于躯干三维扫掠或完整重力。原盆地外外勤仍由主控 legacyActive 门禁关闭，没有暗中新增全球生成规则。
- 性能待实测热点：`expedition-runtime/path.mjs` A* 每轮排序 open 列表，最多 1,600 节点；路径边每 0.2m 调用占据/地形检测；`creature-rig.mjs` 活体每可见帧最多三轮四足变形顶点查询。360m 仅距离裁剪、无远近动画频率分级。未未经基准改变这些系统。
- 人物及车的坡面重力、体积碰撞、球面控制由主控并行修复；本报告不替代它们的实机验收，也不声称解决全球怪物生态。

建议最终实机复测：在真实缓坡引怪上下追逐，确认不穿地；以高台/车顶对近怪起手，确认无越高差伤害；落回地面恢复攻击；陡坡两侧引怪，确认不会因帧率或短步直接穿越。
