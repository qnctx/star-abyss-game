# 营地动态 NPC 阴影刷新 R3

最终版本在阴影调度之外，为本来不透明的场景明确创建不透明 WebGL 缓冲，并请求低延迟画面提交 `desynchronized:true`，同时跳过完全被旧盆地遮罩丢弃的星球网格。4 倍抗锯齿、深度/模板设置、模型和碰撞保持。下面先记录阴影片及其中间验收；最终包结果见文末。

营地 NPC 的位置和骨骼姿态每帧更新。此前任务 NPC 和医师的 `onChange` 均直接要求重绘阴影，静态阴影图因此可能随 60 FPS 帧循环每帧重建。本片将动态姿态/移动标记为 `{dynamic:true}`，由世界场景在渲染前按 0.1 秒合并消费；首次动态请求当帧生效。持续动画时仍按约 10 Hz 更新影子，NPC 的动作、动态碰撞和交谈锁位本身保持原帧率。

建筑 GLB 加载、NPC 资产加载、场景显隐、销毁等未标记的变化仍走立即失效；原世界大门运动也保留原有直接失效。调度器只管 NPC 动态影子，不限制静态内容。`canvas.dataset.performance` 增加 `shadowUpdates`（已请求阴影更新的渲染帧累计数）、`dynamicShadowUpdates`（动态队列触发次数）和 `dynamicShadowPending`（是否仍有待合并的动态请求），便于与同一页面的帧时序对照。计数是渲染请求，不是 GPU 耗时或每盏灯的 draw-call 数。

CPU 验证：

```cmd
node --test playable/src/dynamic-shadow-scheduler.test.mjs playable/src/progression-quests/scene.test.mjs
node --test playable/src/camp-v2/integration.test.mjs playable/src/progression-quests/dialog-layout.test.mjs
node --check playable/src/main.mjs
node --check playable/src/scene.mjs
node --check playable/src/foundation/camp-scene.mjs
```

本地结果：两组共 16 个测试通过，三个语法检查通过。调度器测试覆盖首帧立即、60 FPS 连续请求在 100ms 内合并、积压请求最终消费、无效时间和时钟回退；场景测试覆盖骨骼动画发出动态请求，以及显隐仍为默认即时请求。营地集成回归验证真实台阶、N02 对话锁位、现有动态授权和对话布局。

同时修复自适应渲染只看中位数和 P75、漏掉持续间歇掉帧的问题：每 60 帧统计超过 25ms 的占比，连续三窗达到 8% 才小幅降 0.05；恢复升档要求占比低于 2%。沿用 CPU 饱和排除、4 秒缓冲和 0.9 下限，UI 不随渲染比例缩放。新增持续 12.5% 丢帧与 CPU 饱和对照测试，连同原孤立尖峰测试共 5/5 通过。

总控实测（Intel UHD / D3D11、1440×900、DPR 1.5、渲染比例 1.25；三个场景各 16 秒）：

| 场景 | 基线平均 / P99 ms | 修复平均 / P99 ms | >33.34ms 帧数（前→后） |
| --- | --- | --- | --- |
| 营地静止 | 18.02 / 33.4 | 18.04 / 33.4 | 24→23 |
| 营地转向 | 19.77 / 50.0 | 18.42 / 33.4 | 55→33 |
| 2000m 高速转向飞行 | 16.66 / 16.8 | 16.66 / 16.8 | 0→0 |

最终包 SHA256：`2a2c3b3039bbad92555fe4d733e9d30f50faf73ccfcff22d355a06ef584698c5`。证据：`artifacts/r3-baseline/report.json`、`artifacts/r3-shadow-only-report.json`、`artifacts/r3-candidate/report.json`。同一营地转向的动态阴影计数增加 153 次 / 16 秒，约 9.6Hz。仅阴影修复时转向平均 18.52ms、P99 33.4ms；最终自适应逻辑在本次短测没有观察到降比例，不能把本次实测改善归因于降画质。营地仍有 69–80ms 孤立长任务，静止帧时无显著改善，不宣称全场景稳定 60FPS。

手工回归：刷新试玩页面，在营地连续走动并转视角 30–60 秒，靠近 NPC 按 F 对话并关闭；观察脚部阴影跟随、模型和建筑阴影完整。按 G 起飞、W 飞行并按 V 切换视角，再用 Ctrl 下降（F2 跳高度后先点“恢复键盘飞行”）。

独立 headed 浏览器连续 60 秒 W/S 行走和鼠标转向（同一最终包，位置从 z211 开始，路径不同于上述短测）：自适应比例实际从 1.25 分七次下降到 0.9；平均 23.71ms、P95 33.4ms、P99 50ms，7 个 55–75ms 长任务。此结果证明自适应确实工作，但持续营地行走仍有明显掉帧，不能视为性能完全修复。N04 真实步行后按 F 对话成功，对话期间 NPC 位移为 0，页面错误为 0；测试结束已关闭浏览器。详见 `artifacts/r3-browser-camp-independent/report.json`，其 complete 表示检查流程完成，不表示稳定 60FPS。

后续定位与最终包：headed CPU 回调 P50/P95 为 6.6/11ms，完全跳过 render 的临时 QA 页面恢复 16.66ms，排除输入采样为主要因素。单独关闭 MSAA，或临时隐藏地形、岩石、星球外层均没有显著收益，因此全部保留。低延迟提交路由实验使用 alpha=true；最终实现显式 alpha=false 并请求 desynchronized=true，保持 depth=true、stencil=false、premultipliedAlpha=true、preserveDrawingBuffer=false、antialias=true。独立源码审查确认：Three 的 renderer 参数默认 alpha=false，但内部实际 getContext 请求 alpha=true；因此最终实现明确改成不透明缓冲，不能声称底层 alpha 完全未变，或将所有改善仅归因于 desynchronized。场景原本不透明，截图无透明合成需求。浏览器不支持低延迟提示时可忽略，不减少内容或更改模拟速度。

最终包 `fd8906d3ef11f4cec49976a94ab79f9b58d6fe9b9343b50072ae66be202e51bc` 的同条件短测（`artifacts/r3b-candidate/report.json`）：营地静止平均/P95/P99 为 16.72/16.7/16.8ms；营地转向 17.19/16.8/33.3ms，>33.34ms 帧从原始 55 降到 7，比例从 1.25 自适应至 1.2；高速飞行 16.65/16.7/16.8ms，无长任务。此处为三段各 16 秒 headless 样本，最终 headed 连续运动另行记录。相关 CPU 回归 24/24，通过场景/台阶/对话/阴影/自适应/遮罩剔除测试。星球剔除严格等价的边界条件见 `PLANET-LEGACY-CULL-R3.md`。

最终独立 headed 60 秒连续操作通过（`artifacts/r3b-browser-final/report.json`，同包，无 QA 路由替换）：营地平均帧时由中间版 23.71 降为 18.48ms，约 42→54FPS；>33.34ms 帧由 391 降为 169（减少约 57%），长任务 7→4。实际缓冲 alpha=false/desynchronized=true/4xMSAA；自适应比例最低 1.05，比中间版最低 0.9 更高。仍有 P95 33.4ms/P99 50ms 的间歇长帧，不承诺恒定60FPS。N04真实行走后F对话成功、交谈位移0，2000米飞行真实按V切第三人称成功，页面错误0。最终入口4173 HTTP bundle SHA已核对，独立浏览器测试结束后关闭。
