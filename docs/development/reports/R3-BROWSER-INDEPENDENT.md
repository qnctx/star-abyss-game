# R3 独立浏览器验收与卡顿定位

2026-09-25，独立 headed Chromium、Intel UHD/D3D11、视口 1440×900、DPR 1.5。页面实际 HTTP `game.js` SHA-256 为 `2a2c3b3039bbad92555fe4d733e9d30f50faf73ccfcff22d355a06ef584698c5`。所有浏览器运行已关闭；未改生产源码。

## 真实营地运动与交谈

[60 秒报告](../../../artifacts/r3-browser-camp-independent/report.json)在营地真实按 W/S 并用鼠标转向，角色位置和 yaw 均变化。rAF 均值 23.71 ms、p95 33.4 ms、p99 50 ms、超过 33.34 ms 的帧 391 个、longtask 7 个（55–75 ms）。renderRatio 由 1.25 逐次降至下限 0.9，最后十秒仍有掉帧；不能宣称全程 60 FPS。营地静止/短时转向的改善不代表持续运动已流畅。

N04 在固定机位 3.4 秒实际移动 0.494 米，动态阴影刷新计数 557→592，约 10 Hz；[前](../../../artifacts/r3-browser-camp-independent/npc-shadow-before.png)、[后](../../../artifacts/r3-browser-camp-independent/npc-shadow-after.png)截图能看到近身地面接触暗影，夜间对比度低，难以从截图单独量化阴影轮廓。玩家从 5.55 米外真实步行到 2.92 米并按 F 打开[对话](../../../artifacts/r3-browser-camp-independent/npc-dialog.png)，交谈期间 NPC 位移为 0；中文和关闭按钮可读。报告页面错误为 0。

## CPU 与 MSAA 对照

[headed profile 报告](../../../artifacts/r3-headed-profile/report.json)先运行 20 秒不读取整份游戏快照的营地运动对照，仍有 rAF 均值 23.45 ms、p95 33.4 ms、p99 50.1 ms、超过 33.34 ms 的帧 94 个，renderRatio 1.25→1.15。其 rAF 回调 CPU p50 6.6 ms、p95 11 ms；再做 20 秒 CDP 采样的段落为 6.5/10.7 ms，记录在 [CPU profile](../../../artifacts/r3-headed-profile/cdp-profile.cpuprofile)。profile 含约 13.2 秒 `(idle)`，说明这些 33–50 ms 帧大多不能仅用 JS 主回调耗时解释；CDP 段不用于直接比较性能。WebGL 查询为 `antialias=true`、`SAMPLES=4`、canvas 1800×1125。

[关闭 MSAA 的单变量对照](../../../artifacts/r3-headed-no-msaa/report.json)只通过 Playwright 请求路由把渲染器唯一的 `antialias:!0` 改成 `!1`，不改磁盘源码。路由记录原 SHA `2a2c3b…` 和修改后 SHA `6913da1b…`，页面确认 `antialias=false`、`SAMPLES=0`。相同 headed/DPR/营地 W/S 与鼠标轨迹、20 秒不读取整份快照时，rAF 均值 23.73 ms、p95 33.4 ms、p99 50 ms、超过 33.34 ms 的帧 105 个，renderRatio 同样 1.25→1.15。关闭 4× MSAA 没有改善这轮卡顿；不能把 MSAA 认定为主要瓶颈。

## 绘制定位与最终同包复验

同一轨迹下，仅通过浏览器路由把 `renderer.render` 包为无绘制空函数，20 秒 rAF 均值恢复到 16.66 ms、p99 16.9 ms、慢帧及 longtask 均为 0，renderRatio 保持 1.25；这证明主要压力位于绘制路径，不能据此删除真实画面。[无绘制对照](../../../artifacts/r3-headed-no-draw/report.json)。单独隐藏 `planet-terrain`（255 mesh/约 502k 三角）、`legacy-terrain-chunks`（144/720k）、`physical-rock-field`（56/174k）各 20 秒仍约 23.5 ms，均无明显收益；[完整 mesh inventory](../../../artifacts/r3-headed-layer-planet-terrain/mesh-inventory.json)及三个层对照报告保存在相应 `r3-headed-layer-*` 目录。

测试路由显式创建 `desynchronized=true` WebGL2 context 时，浏览器实际返回 true，同条件 20 秒均值 18.98 ms，较原候选 23.45 ms 有改善。不过该测试路由同时改变了 context 的 `alpha` 属性，不能把改善单独归因于 `desynchronized`。[路由证据](../../../artifacts/r3-headed-desync/report.json)。

最终生产构建页面实际 HTTP SHA 为 `fd8906d3ef11f4cec49976a94ab79f9b58d6fe9b9343b50072ae66be202e51bc`。[最终 headed 报告](../../../artifacts/r3b-browser-final/report.json)确认实际 WebGL 属性 `alpha=false`、`desynchronized=true`、4× MSAA，视口 1440×900、DPR 1.5；相对旧版实际 context，`alpha` 与 `desynchronized` 两项变化，不能单独归因。60 秒真实营地 W/S 与鼠标转向的 rAF 均值 18.48 ms（旧 23.71）、p95 33.4、p99 50，超过 33.34 ms 的帧 169（旧 391）、longtask 4（旧 7），renderRatio 1.25→1.05（旧至 0.9）。卡顿显著减轻，仍有偶发慢帧，不能宣称全程 60 FPS。N04 从 5.55 米外真实步行到 2.92 米后 F 对话成功且交谈位移 0；飞行 V 切第三人称后 `flightActive`、`avatarVisible` 均为 true。人工审看[对话](../../../artifacts/r3b-browser-final/npc-dialog.png)与[飞行视角](../../../artifacts/r3b-browser-final/flight-V-third-person.png)，中文可读，角色背部自然垂臂和细尾迹正常。
