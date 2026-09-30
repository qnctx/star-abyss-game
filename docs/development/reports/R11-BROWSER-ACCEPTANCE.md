# R11 地空同体裂翼兽独立浏览器验收

最终候选在 `4180` 实测，`game.js` HTTP SHA-256 为 `9e65b24a63fbd4b6fe26a80f077419d2f398b7170886141e22721251d1dac8b3`，GLB HTTP SHA-256 为 `c1072aae2fd4e0f323739e1058ca8404b1c2fdd4d708fa4d7016923f6d9b9c02`，分别与冻结构建及本地模型一致。执行 `node artifacts/r11-browser-check.cjs` 后，`artifacts/r11-candidate/report.json` 为 `complete: true`，24/24 断言通过，页面与游戏内错误均为空。浏览器已关闭。

同一个 R4 `riftwing-hunter` 实例从真实地面进入爪扑并被左键击中，生命由 311,040 降至 298,599。真实按住 G 升至约 11 米，怪物经历 takeoff、air 并追至玩家同高；空中观察到 dive 攻击，左键再将生命降至 286,158。真实按住 C 后双方回到地面，同一实例继续战斗。玩家通过 19 次近身点击及实际鼠标转向、W 追击将其击杀；尸体侧卧、单个掉落出现。靠近后按 H，背包裂翼羽核从 0 增至 1；重载和再次使用 F2 入口后，实例仍死亡，库存仍为 1，没有重复掉落或复活。

只读渲染快照记录了 `ground-claw`、`takeoff`、`flight`、`dive`、`sweep`、`land`、`death` clip，且模型可见。`ground-approach-third-person.png` 展示地面完整模型，`air-pursuit-third-person.png` 展示追飞双翼，但其躯干被近距玩家遮住；`ground-kill-or-limit.png` 展示贴地侧卧尸体。空中无遮挡全身取景未单独完成，不能仅凭该 PNG 声称已目视验证所有部位。地面和死亡的左上外勤条、任务框在两次 rAF 呈现后不相交，中文可读。死亡状态刚提交时曾瞬时读到 4 CSS px 矩形交叠，随后画面与矩形恢复 12px 间隔；该瞬时采样保留在报告中。

脚本使用 F2 的独立地空追猎存档入口，以及真实键盘和鼠标，不调用 `place`、`face` 或 `advance` 注入位置和伤害。`artifacts/r11-attempt1/` 保存初版稀疏采样与旧 HUD 交叠证据，`artifacts/r11-attempt2/` 保存 HUD 修复后、死亡布局尚未等两次 rAF 的采样证据。复验时核对最终报告的 `bundleSHA`、`assetSHA`、24 个 `assertions`、`errors` 和 `gameplayErrors`，再审看同目录的地面、追飞、死亡、拾取 PNG。
