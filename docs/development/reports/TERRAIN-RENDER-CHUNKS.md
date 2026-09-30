# 原盆地地形精确分块

日期：2026-09-16。生产新增 `playable/src/terrain-render-chunks.mjs`，本切片不改 scene 接线、物理或模型造型。

API：`createTerrainRenderChunks(THREE, sourceGeometry, material, segments = 600, chunkCells = 50)` 返回 Three Group。默认 6km / 600 格地形拆成 144 个 500m 绘制块，每块 5,000 三角形，共 720,000 三角形，原精度完整保留。

每块拥有独立 BufferGeometry / 属性数组 / index / boundingBox / boundingSphere。Position、UV、颜色、法线逐值复制，含整数 normalized 属性；接缝法线不重新生成，精确共享原计算结果。材质由各块共享；receiveShadow=true，castShadow=false；原 sourceGeometry 的释放归调用者，每块 geometry 由场景退出时释放。

这样 Three 原生 frustum culling 可以剔除视野外块；不依赖自定义每帧循环、不降低地形精度、不改变碰撞高度。相对于原整体 mesh，会增加可见块 draw call，减少背后/远处地形三角形提交；具体 GPU 收益必须由主控对实际入口实测，不用 Node 时间推算游戏 FPS。

验证：`node --test playable/tests/terrain-render-chunks.test.mjs`，3/3 PASS。覆盖不整除边缘块、完整三角拓扑重组、全部原始属性逐值一致、精确面积与法线接缝、600×600 网格保留 720,000 三角、真实 Three Camera/Frustum 仅命中部分分块、非法网格拒绝。

接线：先完成 sourceGeometry 的高度/颜色/法线计算，再以原材质创建 Group 并加到 scene，保留 ground 引用以供世界切换 visible；随后 sourceGeometry.dispose()。模块不会擅自释放 source 或 shared material。
