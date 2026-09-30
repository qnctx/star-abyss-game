# R6 Space / G 起飞独立浏览器验收

在 4180 候选包中使用独立 Playwright Chromium、1440×900、DPR 1.5 和真实键盘输入。元婴场景只用 F2“安全返营”回到地面，并以 G、Space 分别起飞；没有通过测试钩子直接设置飞行状态。原始状态和截图见 [R6 报告](../../../artifacts/r6-candidate/report.json)，页面实际请求的 `game.js` SHA-256 为 `cc030126f022fa9e6365dfa76958589132274b45f64d12c2334d50b9ca4a893e`。报告 `complete=true`，页面错误为空。

| 真实操作 | 结果 |
| --- | --- |
| 元婴地面按住 G | 脚高 0→19.96 米；行星自身飞行 active=true，旧跳跃/助推 airborne=false、thrusting=false；角色姿态为 flight。 |
| 元婴地面按住 Space | 脚高 0→19.14 米；同样进入行星自身飞行，旧跳跃/助推标志均未开启。 |
| 元婴空中按住 Space | 脚高 39.87→62.41 米，继续上升。 |
| 普通 L0 地面按 Space | 脚高 0→0.79 米，旧 jump.airborne=true，行星自身飞行 active=false。 |
| 乘车按 Space | 真实 F 上车，W 加速至 10.95 米/秒后 Space 刹至 0；行星自身飞行未启动。 |

人工对照 [G 第三人称](../../../artifacts/r6-candidate/ground-G-third-flight.png)与 [Space 第三人称](../../../artifacts/r6-candidate/ground-Space-third-flight.png)截图：两者均呈自然垂臂的相同元婴飞行姿势，近身淡蓝尾迹一致，未见旧双锥喷焰或跳跃张臂姿势；状态快照两侧肩角最大差约 0.006 弧度。两种操作的第一人称截图均显示无遮挡的地表和清楚的中文 HUD。测试钩子没有直接暴露 `jets.visible`；“旧喷焰未出现”依据 `mobility.flight.thrusting=false` 与人工截图核对，不冒称已直接读取 Three 物件可见性。

复验：启动同一候选包后运行 `node artifacts/r6-browser-candidate.cjs`，检查报告 `bundleSHA`、`complete`、`errors` 和 7 张截图。脚本使用独立测试档与普通 L0 的新浏览器上下文，关闭前一个 WebGL 页面后才打开下一个。
