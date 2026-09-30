# R2 候选浏览器验收

2026-09-25，独立 Chromium 无痕上下文对 4180 候选包进行真实浏览器验收。最终页面实际请求 `game.js` 的 SHA-256 为 `c0a97648c61807ff35f3ea3883a7c0293dd1c581dbee74f3ee148324f6db4b87`，与 `artifacts/r2-build-inputs.json` 一致。每项测试单独启动浏览器并在结束时关闭；未写入 4173 或用户浏览器存档。

## 最终同包结果

- [整合报告](../../../artifacts/r2-integrated-browser/report.json) `complete=true`，页面错误为 0，营地 GLB 请求均为 HTTP 200。真实按住 Ctrl+W 从地面登上指挥所台阶：脚高由 0 升至 0.88 米，位置由 `(-17, 180.87)` 到 `(-17, 176.48)`；不是从建筑外直接触发交互。五名 NPC 的根坐标实际位移 0.56–1.67 米，其中四名的腿骨旋转随步行变化。玩家真实步行到 2.92–3.04 米范围，逐人按 F 均打开对话；交谈期间该 NPC 位移为 0。N01 对话中点击接受后，Q01 状态变为 active。脚本仅用测试钩子设置合法初始位置及鼠标点击后校正朝向，F 的真实距离、朝向、移动与对话判定仍由游戏处理。
- [营地截图](../../../artifacts/r2-integrated-browser/camp-overview.png)人工审看：远处五人名牌已隐藏，没有旧版宽暗底叠字。五张对话截图中文可读，关闭按钮可见；[台阶截图](../../../artifacts/r2-integrated-browser/platform-entry.png)记录登台实际视角。
- [四场景性能报告](../../../artifacts/r2-candidate-performance/report.json) `complete=true`，页面错误为 0。每场景 1440×900、20 秒真实 rAF 测量，`PerformanceObserver` 支持 longtask。下表位移来自前后玩家根坐标，而非 HUD 速度。

| 场景 | 根水平位移 | rAF 均值 / p99 | >33 ms 帧 | longtask |
| --- | ---: | ---: | ---: | ---: |
| 营地静止 | 0 米 | 16.67 / 16.8 ms | 1 | 0 |
| 30 米持续 W | 528.65 米 | 16.66 / 16.8 ms | 0 | 0 |
| 2000 米持续 W | 8399.13 米 | 16.65 / 16.8 ms | 0 | 0 |
| 高空切视角 | 0 米 | 16.85 / 16.8 ms | 6 | 0 |

2000 米场景始末 flight speed 为 415.24→420 米/秒，星球 session 北向坐标也相应变化；未重现旧基准 20 秒几乎停滞。30 米场景末态速度约 0，截图显示与旧残骸相撞，528.65 米不能解释为无障碍飞行的速度上限。rAF 受 60 Hz 刷新上限影响，不能据此宣称 FPS 提升；本轮性能改善的直接证据是同条件高空长任务从旧包的 14 次、约 3563 ms 降到 0 次。高空终点地表有颜色和纹理，`planet.chunks=192`；公开快照未提供 `terrain.pending`，不能据此宣称所有地表已可降落。

- [同包第三人称截图](../../../artifacts/r2-browser-third-person-final/third-hover.png)、[前进](../../../artifacts/r2-browser-third-person-final/third-forward.png)、[转向](../../../artifacts/r2-browser-third-person-final/third-turn.png)人工审看：能看到角色背部、自然垂臂、轻微前倾和细尾迹，没有举拳或喷火。第一人称隐藏完整角色与装备，视野无近处穿模；参考板下缘双手尚未交付。
- [HUD 四尺寸报告](../../../artifacts/r2-browser-hud-final/report.json) `complete=true`、同包 SHA。1440×900、900×500、670×700、390×640 下 V 切换提示中文完整，与地名、飞行读数、控制区、F2 徽记及任务提示无矩形重叠；底部六个按钮均在屏内且可点击。截图位于同目录。

## 真实下降与地表边界

初次[下降记录](../../../artifacts/r2-browser-ground-ready/report.json)在 F2 高度跳转后直接按 Ctrl，位置悬停。根因是实验室高度按钮将 `lab.flightMode` 设为 `hover`，测试脚本没有点击真实的“恢复键盘飞行”按钮；`test-lab.mjs` 在此模式覆盖了下降输入，故初次记录不是产品降落故障。

[同包复验](../../../artifacts/r2-browser-ground-ready-retest/report.json)通过 F2 面板真实按钮恢复 `manual`，用真实键盘按下 `ControlLeft`；100/500/1000 毫秒的 `controls.walk` 均为 true，窗口 `locked=true`、`screen=playing`。30 米营地原地下降时，脚高 30→0 米，约 13 秒后 `flight.active=false`，[落地截图](../../../artifacts/r2-browser-ground-ready-retest/30m-descent-end.png)可见营地地面，证明安全落地真实可用。再次从 2000 米持续 W 20 秒到约 8 公里终点，手动 Ctrl 下降前 1 秒脚高 1757.87→1699.45 米、竖直速度达到 -65 米/秒；37 秒连续下降至脚高 -39.15 米、地表上方约 27 米，区块数 192、地形 epoch 5→14，[末端截图](../../../artifacts/r2-browser-ground-ready-retest/descent-end.png)出现近地森林树木。该脚本在 37 秒上限结束时仍处于飞行状态，**远端最终接地未单独确认**；已确认先前的冻结并非真实键盘飞行状态下的地表停滞。

## 旧轮次留档

旧包及其已修复阻塞分别保存在 `artifacts/r2-integrated-browser-attempt1/`、`-attempt2/`、`-attempt3/` 和对应性能目录。第二轮台阶未进入、旧远距名牌过宽与视角提示遮挡；第三轮 N02/N04 测试受鼠标点击取得 pointer lock 后朝向变化影响，最终脚本在点击后重新面向真实路线/NPC，没有放宽交互阈值。默认整合与性能目录只保留上述最终同包报告和通过截图，不混入旧版失败图。
