# R4 飞行下降按键独立浏览器验收

2026-09-25，对 4180 候选包使用独立 Chromium 测试上下文，页面实际请求 `game.js` 的 SHA-256 为 `6b6a96b6553c6ea060acecc15af5449219bd10c88a87e0b809ce492532866fe0`。[原始报告](../../../artifacts/r4-candidate/report.json) `complete=true`，页面错误为 0，浏览器已关闭。测试通过 F2 高度按钮进入飞行后，点击真实的“恢复键盘飞行”按钮；移动、下降、蹲伏均由 Playwright 真实键盘事件完成，没有注入飞行位置或动作。

- 200 米起点同时按住 W+C 约 3 秒，玩家脚高下降 80.03 米、水平前进 451.58 米。[下降截图](../../../artifacts/r4-candidate/200m-W-C-descending.png)显示 HUD“离地 121 米”“下降”与实际航速。松开 C 后竖直速度归零，随后 0.8 秒高度仅再下降约 0.0005 米；[悬停截图](../../../artifacts/r4-candidate/200m-C-released-hover.png)可核对。
- 水平移动键松开并稳定后，单独按住 Ctrl 两秒，竖直速度与脚高都没有变化。此步骤没有同时按 W，因此未触发浏览器的 Ctrl+W 关闭快捷键；[截图](../../../artifacts/r4-candidate/200m-Ctrl-alone.png)。
- 30 米高度下真实 W+C 前进，随后继续按 C 下降，脚高降至 0、flight.active 变为 false，安全落地；[落地截图](../../../artifacts/r4-candidate/30m-C-landed.png)。回营地地面后，C 依次使站姿变为蹲伏再变回站姿；Ctrl 慢走提示仍在。[蹲伏](../../../artifacts/r4-candidate/ground-C-crouched.png)、[起身](../../../artifacts/r4-candidate/ground-C-standing.png)。
- [F2 指南截图](../../../artifacts/r4-candidate/f2-C-guide.png)和飞行 HUD 均显示 C 下降、松开悬停；地面仍显示 C 蹲伏与 Ctrl 慢走。人工审看中文完整、按钮可见。本测试不验证操作系统或浏览器对 Ctrl+W 的实际关窗行为。
