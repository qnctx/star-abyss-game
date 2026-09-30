# R7 飞行只使用 G

最终键位按用户要求统一为：**G 是唯一的元婴起飞、上升键；Space 不参与元婴飞行**。本页覆盖 R6 文档中 Space / G 同起飞的历史描述。盆地地面 Space 恢复普通跳跃，乘车 Space 仍为刹车；飞行中 Space 不会升高，也不会启动旧玄壳助推。C 仍负责下降，松开 G 后悬停。未解锁元婴的 L0 存档保留旧 G 玄壳助推与 Space 跳跃。

主循环现在只在 G 的 `lift` 输入存在、能力已解锁、未乘车且无旧空中状态时，将 G 交给元婴起飞，并阻止起飞被拒后落入旧助推。Space 的 `jump` 不再被合成 `lift`；行星飞行运行时也不再于空中把 Space 合成上升。后续浏览器检查还发现战术控制层曾在 Space 持续按住 0.3 秒后再次合成 `lift`，现已彻底移除，并清零旧 `spaceHoldTime`。R6 已加入的旧喷气/跳跃状态清理、元婴动画站立过渡基姿、旧喷气显隐隔离保留。R5 近地下降曲线和接地时的 G 按键边沿保护也保留。

已同步飞行 HUD、地面移动提示、目标说明、F2 测试面板、装备手册和主页面静态 Space 帮助。普通地面提示明确 Space 跳跃、G 助推；元婴解锁后提示 G 起飞；载具提示 Space 刹车。HTML 的 Space 条目仅说明地面跳跃和车上刹车。

## CPU 验证

```cmd
node --test playable\tests\innate-takeoff-r6.test.mjs playable\tests\input.test.js playable\tests\tactical-control.test.js playable\tests\flight-hud-r2.test.mjs playable\tests\flight-descent-r5.test.mjs
```

结果：45/45 通过。更新后的 R6 测试按最新 R7 语义断言：真实盆地运行时中 Space 不启动元婴、G 启动并清旧推力；飞行悬停后连续按 Space 一秒高度不变、旧助推不启动；L0、禁飞输入、载具刹车和 C+G 接地后需松键再起飞均受测。战术控制测试真实串接 `updateTacticalControl` 与 `stepMobility`，长按 Space 180 帧只跳一次、完整落地、玄壳喷气始终关闭且不消耗能量。HUD、输入及 R5 下降回归通过。相关生产模块语法检查通过。

## 构建后的人工复验

在独立 `?testLab=1` 档盆地地面长按 Space 超过两秒，确认只跳一次并落地、没有元婴飞行动画或旧喷气；落地后按 G，确认元婴起飞与新动画。松开 G 等高度稳定，持续按 Space，确认 HUD 高度稳定、无旧喷气；按 G 应上升，按 C 应下降。C+G 持续按到接地时不反复弹起，松开 G 后再次按可起飞。乘车按 Space 仍刹车，普通 L0 存档 Space 仍跳跃。对照飞行 HUD、F2、目标说明、地面提示与主页面，确认中文字完整且没有 Space 飞行指引。本片未自行构建或启动浏览器/GPU。

## 最终独立浏览器验收

总控构建并由独立浏览器真实键盘操作，最终包 SHA256 `6dff49a47ffa675271b324252c2d73cfcb71cbbb8b6bcd419eae3996627fb392`。报告 `artifacts/r7-candidate/report.json` complete=true、errors=[]，7张截图。G 地面起飞约0→19.14米，元婴 active=true且旧助推关闭；悬停时持续按Space，前后高度均35.9245米。C安全落地。地面Space跳至约0.856米，持续按3.05秒后正常落回地面，整个过程未启动元婴或旧助推。L0 Space仍跳跃，车辆约10.95速度按Space刹至0。相关CPU回归45/45通过。

正式发布及HTTP核验记录见 `artifacts/r7-published.json` 和 `artifacts/r7-published-verification.json`；本页与上述最终包覆盖此前R6双键飞行说明。
