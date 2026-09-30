# R7 仅 G 飞行独立浏览器验收

最终候选在 4180 的独立 Playwright Chromium 中以真实键盘 G、Space、C、F、W、V 操作。只有 F2 的“安全返营／前往车辆”用于将独立测试档放到合法地面位置，没有直接设置飞行状态或注入模拟时间。实际请求的 `game.js` SHA-256 为 `6dff49a47ffa675271b324252c2d73cfcb71cbbb8b6bcd419eae3996627fb392`。[最终报告](../../../artifacts/r7-candidate/report.json)为 `complete=true`，页面错误为空，并保存 7 张截图。

| 场景 | 浏览器实测 |
| --- | --- |
| 元婴地面按 G | 脚高 0→19.14 米，行星自身飞行 `active=true`，旧跳跃与旧助推 `airborne=false`；第三人称显示自然垂臂的元婴飞行姿势。 |
| 空中按 Space | 脚高保持 35.9245 米、竖直速度为 0，旧助推与旧跳跃均未启动；仍为元婴悬停姿势。 |
| 空中按 C | 安全回到地面，松键后未重新起飞。 |
| 元婴地面按住 Space 约 3 秒 | 约 0.35 秒时脚高 0.856 米且 `jump.airborne=true`；按键仍按住时完成一次跳跃并落回脚高 0。行星飞行、旧助推 `airborne/thrusting` 在起跳及长按后都为 false，旧助推能量保持 100。 |
| 普通 L0 地面按 Space | 正常跳跃至约 0.81 米，未进入行星飞行。 |
| 乘车按 Space | F 上车、W 加速至 10.95 米/秒后，Space 刹至 0。 |

人工审看 [G 起飞](../../../artifacts/r7-candidate/ground-G-third-flight.png)、[空中 Space](../../../artifacts/r7-candidate/airborne-Space-hover.png)、[地面 Space](../../../artifacts/r7-candidate/ground-Space-jump.png)及 [C 落地](../../../artifacts/r7-candidate/C-landed.png)：G 和空中悬停维持同一飞行姿势，地面 Space 是明显不同的短跳姿势，没有旧双锥喷焰；中文 HUD 说明“地面 G 起飞／Space 跳跃，空中 G 上升／C 下降”。

首次候选的 [失败报告](../../../artifacts/r7-initial/report.json)已独立归档：它在地面长按 Space 时触发旧助推，SHA `e6232faa…`，不能当作最终结果。修复后由 `node artifacts/r7-browser-candidate.cjs` 全套重跑生成最终 SHA 绑定证据；浏览器已关闭，未触碰用户 IAB 页面。
