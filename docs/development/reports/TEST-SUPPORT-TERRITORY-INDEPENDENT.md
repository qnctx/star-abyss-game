# 脚底支撑与领地行为：独立验证

2026-09-16。本报告仅说明独立测试覆盖范围，不替代浏览器画面验收。验证者没有修改生产代码。

新增测试：

- `playable/tests/foot-support-independent.test.mjs`：6 项。真实普通岩石和真实悬崖 mesh 外缘，脚中心无几何时不同胶囊半径都不产生支撑；旁边实体仍有侧碰撞；悬空进入重力并落地；低于岩顶不吸上去；从上方仍能落在顶面；连续前进可走下岩石且不会被自己的侧碰撞卡住。
- `playable/tests/runtime-territory-independent.test.mjs`：7 项。实例化生产 `createExpeditionRuntime`，使用真实 session/transaction/checkpoint 与内存持久化适配器；15 秒远处巡游跨多个 checkpoint（分别使用平面控制和真实地图碰撞查询）；驾驶时自主巡游；追击、脱离、返巢；营地不受攻击；菜单暂停；返巢期间贴近玩家也不发起攻击；通过真实战斗提交杀死怪物后尸体静止、掉落保留。

复跑命令：

```text
node --test playable/tests/runtime-territory-independent.test.mjs playable/tests/foot-support-independent.test.mjs playable/tests/creature-ai.test.mjs playable/tests/mobility.test.js playable/tests/physical-world.test.js playable/tests/footing.test.js playable/tests/slope-creature-audit.test.mjs
```

结果：58 / 58 PASS；输出 `artifacts/support-territory-independent.tap`。测试覆盖原步行、飞行、载具、存档、足底材质、摄像机防穿模及攻击高度回归。未发现阻断问题。

边界：真实地图巡游验证选取营地东侧陨落带，不代表逐点检查全部地图；平面控制用例用于隔离领地决策与真实事务集成。未在此报告声称全地图视觉、GPU 帧率或所有骨骼动画通过。
