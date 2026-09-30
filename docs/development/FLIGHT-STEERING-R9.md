# R9 飞行转向与空战击退

加速侧移的物理问题在 `planet-gameplay/flight.mjs`：原实现将二维速度向量直接朝新的 A/D 目标推移。以 R9 满速 1,500 m/s、侧转两秒为例，260 m/s² 的向量更新会把速度先压到约 1,190 m/s，再重新加速；快速交替 A/D 会反复经过这个减速区。镜头追踪的目标由角色位置与朝向生成，A/D 本身不会突然改朝向；镜头函数原有的 1.5 米跟随上限保持不动。

现在转向分别更新速度大小和方向：按境界目标速度加速或制动，方向按有上限的角速度旋转。R9 满速侧转仍保持目标速度，最大转角由 900 m/s² 的侧向转向预算和 1.8 rad/s 上限共同限制；转向倾斜值连续缓动。R4 原有最高速度、Shift 能耗、G 唯一起飞、下降、2,000 米高度上限及扫掠碰撞均保留。未加载地形或碰撞仍会停止本帧并清速度；若浏览器实测仍有停顿，应记录 `stepFlight` 的 `reason` 和流式加载状态，不能为顺滑放宽碰撞。

新增 `applyFlightKnockback(flight, {east,north,up}, adapter)`，供空战按帧施加当前位置切平面的米制击退。单次位移上限 12 米，仅空中有效；先验证起终点加载、安全高度与整段 `sweep(.42)`，成功才更新权威球面位置，失败不修改角色状态或能量。成功返回 `{ok:true,reason:'moved',position,landed}`；失败返回 `{ok:false,reason}`，主要原因为 `flight-required`、`invalid-displacement`、`terrain-pending`、`blocked`、`unsafe-surface`。调用方可按战斗冲量曲线分帧提交，不能把失败结果画成已命中位移。

CPU 验证命令：

```cmd
node --test playable\tests\flight-steering-r9.test.mjs playable\tests\flight-r2.test.mjs playable\tests\flight-descent-r5.test.mjs playable\tests\ascension-flight-r8.test.mjs
```

当前结果 20/20。覆盖 R9 全速 30/60/120 FPS 侧转、快速 A/D 反转的速度和角度连续性、相机跟随上限，以及真实球面击退、墙体阻挡、未加载路径和失败不改状态。本片未构建或运行浏览器/GPU；实机镜头与资源流式加载仍由总控串行复验。
