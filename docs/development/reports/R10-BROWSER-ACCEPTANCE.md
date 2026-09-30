# R10 浏览器独立验收

候选 `4180` 的实际 HTTP `game.js` SHA-256 为 `f70fd9b64fc315cb0f400312a55b51fa8147b2c6fe8f3e83929117256378e4d9`，与 `artifacts/r10-cpu-validation.json` 一致。独立 Playwright 浏览器在 1440×900、DPR 1.5 下运行 `artifacts/r10-browser-check.cjs`；使用真实键盘和鼠标输入，没有注入飞行、敌人或伤害状态。最终 `artifacts/r10-candidate/report.json` 为 `complete: true`，15 项断言全通过，JavaScript 和游戏内错误均为空。测试结束后浏览器已关闭。

从静止按住 `Shift+A` 或 `Shift+D` 各 2.25 秒，`boosting` 全程为真，`turnBank` 分别稳定在约 −0.65 和 +0.66；按住 `Shift+W+A`、切换至 `Shift+W+D` 后也维持对应倾侧，第三人称角色与气流方向见 `artifacts/r10-candidate/third-person-shift-WA.png` 和 `third-person-shift-WD.png`。松开侧键时，bank 先保持约 ±0.65，再于 150 毫秒后降至约 ±0.09，未瞬间归零。截图中任务框、飞行读数、F2 按钮与中文提示未见遮挡或裁字。帧采样包含加载与截图停顿，仅用于排查卡死，不作为性能跑分。

在 F2 真陪练场景，首次点击画布只捕获视角，未发动攻击。玩家用真实 `W` 从 1.30 米接近到 0.68 米后，左键打出 `left-jab`；在其 recovery 内提前点第二下，当前招式仍为 jab，随后自动接 `right-cross`；第三下为 `rising-kick`。陪练生命从 1,244,160 降至 1,196,884，出现 `launch` 事件，敌人 y 从 33.80 升至 35.77。动作和敌人位置见 `third-person-mouse-kick.png` 与 `third-person-combo-end.png`。初轮没有预先接近时，cross 因真实距离约 1.96 米打空，随后的 kick 被敌方 lunge 打断；失败证据保留在 `artifacts/r10-attempt1/`，未通过放大命中距离或直接改位置消除。

右键按住进入格挡，叠加 `O` 后松右键仍格挡，松 `O` 后解除；未锁定拖动画布、首个捕获点击、打开及关闭 F2 菜单均未触发近战。自动化报告保留每阶段 `captureStatus`、`locked`、攻击事件、敌人生命及位置，可复核输入隔离。

复验步骤：在仓库根目录执行 `node artifacts/r10-browser-check.cjs`，检查 `artifacts/r10-candidate/report.json` 的 `bundleSHA`、`complete`、`assertions`、`errors` 和 `gameplayErrors`，再审看同目录的五张截图。该测试限于 R10 侧飞与近战输入闭环；不代表整片开放世界性能或所有镜头角度已逐一验收。
