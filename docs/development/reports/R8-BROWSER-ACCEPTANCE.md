# R8 独立浏览器验收

2026-09-26，候选站 `http://127.0.0.1:4180/`。浏览器实际下载的 `game.js` SHA-256：`7427160201567fbbc47f53b70dc9b44c93580b73e41c88136a83c2b913e78c0b`。证据见 [总报告](../../../artifacts/r8-candidate/report.json)，其中附四份原始 JSON 与十张截图；`complete=true`、`errors=[]`。图鉴 `ascension-gallery.js` 的实际 SHA-256：`0639b0abc5b872bd570a185103adff064e19098a317db89dd6e7aecf37274852`。

- R6：真实键盘 W 两秒飞行位移 338.27 米；Shift+W 为 615.03 米。第三人称模型和气流可见，`boosting` 与 `boostVisible` 均为真。Y 短虚步位移 12.00 米、冷却约 8 秒，重载后冷却仍保留；Shift+Y 的 60 米预览可确认，确认后真实位移 60.00 米、灵息减少 25%。
- R8/R9：F2 放到实际空战点后切回键盘，每境真实按 R 一次，外勤 `simTime` 增长，目标 HP 96→0、`alive=false`，均生成真实掉落。第三人称施法、命中图和 HUD 已人工审看。R8 空中等待时敌方远程反击将玩家 HP 从 201553920 降至 201553901。
- R8 地面闭环：R 击杀后真实按住 C 约 2.18 秒落地，朝尸体用 W 从 19.52 米走至 2.17 米，出现“掠兽遗留物”交互。真实按 H 后遗留物 2→1，背包新增“掠兽血液”1；重载后背包和剩余遗留物保持。
- 图鉴：R4–R9 六个实际 GLB 均可加载（网格数依次 1、1、4、3、3、3），每个 GLB 和 Blender 源文件下载链接均返回 HTTP 200。390px 宽页面 `scrollWidth=390`，R9 模型、中文说明与链接可见，无页面横向溢出；检查了宽、窄两张截图。

本轮浏览器没有重复 R7 的 G 起飞 / Space 跳跃全键位流程，也未逐一跑 R8/R9 虚步距离与冷却、盆地外攻击拒绝及四种游戏 HUD 尺寸。这些不能由本报告的 `complete` 解释为已经浏览器实测；相关规则已有 CPU 验证。该报告的 `complete` 只代表上述八项明确断言及无页面错误。

复测可运行 `node artifacts/r8-browser-smoke.cjs`、`node artifacts/r8-air-combat-check.cjs`、`node artifacts/r8-loot-check.cjs`、`node artifacts/r8-gallery-check.cjs`，最后运行 `node artifacts/r8-aggregate.cjs`。脚本使用独立测试档与真实键盘输入；F2 只负责准备空战位置/飞行高度，未注入攻击、掉落或移动结果。浏览器验收结束已关闭所有测试浏览器，释放 GPU。
