# R3 旧盆地内的星球地表网格剔除

在原六公里地图仍显示时，星球地表着色器会将旧盆地内、前半球的片元全部丢弃。此前这些地表网格仍提交给渲染器。本片在网格加载时检查 **Float32 顶点属性**（包括裙边）：只有每个顶点都严格位于着色器的正面与遮罩矩形内，且保留保守边界余量，才记录为完全被遮罩覆盖。仅在遮罩开启、混合值恰为 0、网格没有水面子网格时隐藏该网格。跨界、反面、含水网格继续绘制；混合值大于 0 或遮罩关闭时立即恢复。

这个判断只改变 `mesh.visible`。着色器、原始几何、活动网格映射、缓存、射线检测与精确地表采样没有改动。新网格加载和缓存网格重新发布都会根据当前状态设置可见性；遮罩或混合值不变时，setter 不额外遍历全部网格。

CPU 回归命令（现有星球集成测试需要显式指向当前工作区，避免其默认 E 盘基线）：

```cmd
set PLANET_BASELINE=C:/Users/HUAWEI/.codex/worktrees/3ff0/star-abyss-game&&node --test playable/tests/planet-legacy-chunk-cull-r3.test.mjs playable/tests/planet-integration.test.mjs playable/tests/planet-stream-budget-r2.test.mjs
node --check playable/src/planet/scene-adapter.mjs
```

结果：12/12 测试通过，语法检查通过。新增测试覆盖严格边界与负坐标、反面和零深度、水面、混合与遮罩切换、新加载和缓存重发布，以及被隐藏期间表面采样与几何保持不变。

待总控构建后的独立浏览器验收：在相同营地站位、画质和浏览器条件下比较关闭/开启此剔除的 draw calls 与帧时；检查六公里边缘、飞行高空混合和远处有水地表，不应出现缺口。CPU 测试证明剔除条件与状态切换，尚不构成 GPU 帧时收益或最终画面验收。
