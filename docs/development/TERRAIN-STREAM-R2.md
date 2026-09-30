# R2 高速飞行 CPU 尖峰审计与修复

复测候选 `artifacts/r2-candidate-performance-attempt2/report.json` 在离地 2000 米持续前进 20 秒走过约 8036 米，最终速度 420 米/秒；同段出现 13 个 long task，合计 3510 毫秒，最长 376 毫秒。`artifacts/r2-browser-third-person-attempt2/high-flight.cpuprofile` 的 9.55 秒 CPU 样本中，旧六公里地形坑纹高度函数（bundle 名 `oc`）独占约 3389 毫秒。最初误判为地形块构建；解开调用栈后，主要路径实际是 `runtime-world.mjs:sweep()` 的 0.25 米连续扫掠及四侧探针，经 `loaded()`、`field.sample()` 反复调用旧高度函数。全球地形上界 5085 米高于当前 2000 米飞行高度，故连续线段壳体的全局快通道不能安全触发。不能任意扩大扫掠步长。

早期把 `planet/chunks.mjs` 和 `planet/scene-adapter.mjs` 的行级 yield 改成逐顶点 yield，保留了输出和旧网格原子发布，但**未解决**真实尖峰：新包 `artifacts/r2-candidate-performance/report.json` 仍飞行 8057 米、末速 420 米/秒，出现 14 次 long task/3563 毫秒/最长 374 毫秒，p99 为 116.7 毫秒，与旧包同级。该修改保留为单步预算防护，不视作性能验收通过。

进一步的 CPU 对照指向 `layout.mjs:gridHeight()`：原 600×600 六公里网格内的确定性格点已缓存，±3000 至 ±4000 米过渡带的越界格点却每次重新运行 `rawHeight()`。同一 7 米高空连续扫掠（原 0.25 米步长和四侧探针）重复执行时，x=3100/3500/3900 米前值均约 63–71 毫秒。现为越界**整数格点**加最多 32768 项的有界缓存，仅复用原 `rawHeight()` 的结果，不改变公式、边界、步长、loaded 或固体碰撞。相同脚本重复均值分别降为约 9.1/6.5/6.5 毫秒；这只是本机 CPU 微基准，浏览器尚未复测该包。21 个正负坐标、±3000 边界及重复坐标的高度与缓存前捕获值逐位一致。

定向 CPU 验证命令：

```sh
node --test playable/tests/legacy-outer-grid-cache-r2.test.mjs playable/tests/planet-stream-budget-r2.test.mjs playable/tests/performance-regression.test.mjs playable/tests/planet-architecture.test.mjs playable/tests/flight-r2.test.mjs
node artifacts/r2-sweep-cpu-diagnostic.mjs
node --check playable/src/layout.mjs
node --check playable/src/planet/chunks.mjs
node --check playable/src/planet/scene-adapter.mjs
```

测试覆盖缓存前后精确高度、单步至多一个地表顶点、取消渐进任务后旧六面覆盖不丢、旧 mesh/碰撞数据复用及生命周期、同步与渐进生成的全部顶点、法线、颜色、索引一致。`planet-integration.test.mjs` 默认单独依赖 `E:\myProject\star-abyss-game\package.json` 解析 `three`，该路径缺依赖时启动失败；总控改用测试现有的 `PLANET_BASELINE` 环境变量指向当前工作区后，6/6 通过（`artifacts/r2-planet-integration.tap`），没有修改测试或安装依赖。

CPU 微基准不能证明浏览器帧时间。合并构建后仍需按同一 1440×900/2000 米/W 20 秒路径复测：实际位移、long task 数/总时长/最大值、p99、地形覆盖与落地 ready。若仍有尖峰，应以新包 profile 继续追踪；不能用降低实际位移掩盖卡顿。

`planet-integration.test.mjs` 的 6/6 验证包括原盆地 3721 个高度采样、路线坡度/河流/大陆、Three 网格遮罩/射线/销毁与背面山地及两极的地面就绪。
# 最终浏览器结果补充

缓存版构建 `c0a97648c61807ff35f3ea3883a7c0293dd1c581dbee74f3ee148324f6db4b87` 的同路径20.001秒高空采样：实际水平位移8399.13米、末速420m/s、平均16.654ms、p99 16.8ms、0帧超过33ms、0长任务。前版c906同路径为14长任务/3563ms、p99 116.7ms。只代表1440×900/D3D11/headless这段测量，不代表所有路线/机器或自然成长全链。完整报告见 `PERFORMANCE-PLAYTEST-R2.md`。
