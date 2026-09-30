# 飞行 HUD R2：收拢调查信息

飞行时，左上调查长说明和地面冲刺帮助会遮挡视野。`createFlightHUD(document)` 在现有 HUD 上增加可展开的“任务详情”和紧凑飞行读数，并按需加载 `playable/css/flight-hud.css`。它只在 `planetRuntime.hud().active === true` 且游戏 HUD 可见时启用 `body.flight-active`；落地或离开游戏 HUD 后恢复原布局，已展开的任务详情也会收起。

读数直接取自每次刷新的 `planetRuntime.hud()`：`agl / maxAgl` 为当前离地高度和 2000 米上限，`speed` 为实际米/秒，`energy` 为灵息，`verticalSpeed` 决定上升、下降或悬停文案。字段缺失显示“—”或“状态未知”，不会补造数字。生命与灵力的远征状态条、灵息量条及底部六个按钮继续显示。地面体力、冲刺提示、重复的飞行说明与底部键位长说明仅在飞行中收起；可点“任务详情”查看完整调查内容。窄屏将目标和位置压在上沿两侧，灵息块与底部按钮分列两侧，避免同区覆盖。

主循环的最小接线由 `main.mjs` 所有者执行：

```js
import {createFlightHUD} from './flight-hud.mjs';

// DOM 就绪后，只初始化一次。
const flightHUD = createFlightHUD(document);

// 每次 refresh() 的 ui.update(...) 之后。
flightHUD.update(planetRuntime?.hud());
```

样式由模块自动装入，无需改 HTML 或既有 `game.css`。`refresh()` 应在地面、飞行、切换界面时继续调用，以便恢复 HUD 状态。

验证：

```sh
node --test playable/tests/flight-hud-r2.test.mjs
node --check playable/src/flight-hud.mjs
```

2026-09-25 CPU 结果：DOM 状态切换、真实读数更新、详情展开/收起、不可用数据回退共 2/2 通过；语法检查通过。浏览器布局仍需接线后，在 1440×900 与窄屏实机检查文字、按钮可点区域及中央视野。
# 飞行切视角提示补修

独立实机截图发现原 V 提示覆盖右上地名/坐标。飞行期间的提示现简化为“已切换第一/第三人称”，放在底部控制区上方；地面原说明保留。源码语法检查通过，最终构建还需在1440×900、900×500、670×700、390×640复核提示与地名、飞行读数、按钮和F2入口的间距。
