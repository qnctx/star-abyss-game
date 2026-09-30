# 原盆地与连续行星 Godot 世界模块

`scripts/native_world.gd` 把网页原版的六公里月面盆地迁入 Godot 4.6。世界坐标仍为米，范围是 X/Z 各 `-3000..3000`，北方为 `-Z`。地形高度严格沿用 `playable/src/layout.mjs` 的 10 米网格与同一对角线的三角插值，也移植 `playable/src/phase1-terrain.mjs` 的八处地貌与三处陨坑。无须加载整张 6 km 网格即可查询任意点的地面高度。

原盆地近景渲染和碰撞以 160 米块流式加载：当前位置周围 3×3 块同步可用，其余 9×9 范围每次 `update_stream` 最多生成 2 块；离开的块回收。可见网格与静态三角碰撞共享顶点，且 `height_at` 使用相同插值。盆地的 ±3000 米是旧内容的视觉/高度所有权范围，不再是玩家通行边界；球面高度场在 3–4 公里间连续接管。

高空需要看完整的六公里地面，所以 `assets/terrain/far_basin.gdshader` 显示一张启动时生成、之后不重建的 40 米采样远景网格：22,801 个顶点、45,000 个三角形、一个绘制网格，不生成远景碰撞。它仍采样上述同一高度函数与玄武岩材质。38×38 的贴图遮罩记录已加载的近景块，让远景在近景下逐块隐藏；近景块边缘的下垂网格覆盖 10 米与 40 米采样间的微小高度差，且不参加物理。独立 Intel UHD/OpenGL 800 米截图确认旧版 9×9 块之外的矩形空洞消失，未见接缝或深度闪烁。

天空的紫色星云、针点星与环纹远星来自网页原来的 `playable/src/scene.mjs` 程序公式。`assets/sky/generate_legacy_panorama.py` 用固定种子把它采样成 2048×1024 的 `legacy_purple_panorama.png`，Godot 使用 `PanoramaSkyMaterial` 展示；不依赖外部图片或付费生成。这样避开 Intel UHD/OpenGL Compatibility 对实时噪声 sky shader 的三角形色块。雾不覆盖天空，地平线颜色缓慢过渡。地面材质直接使用 `playable/assets/environments/phase1/basalt-albedo.png`，原图基于 [第一期月面概念图](../../docs/art/environments/phase1-v1/map-concept.png)。角色、裂翼兽与勘测滑翔车也沿用现成 GLB，未新建 3D 模型：

| Godot 路径 | 来源 | SHA-256 |
| --- | --- | --- |
| `assets/c2-explorer.glb` | `playable/assets/characters/c2-explorer.glb` | `a0922a57c7f4ea221a0b48ca73963346cb100575a69f92c1bcd2922d3064b97f` |
| `assets/riftwing-r11.glb` | `playable/assets/creatures/riftwing-r11/riftwing-r11.glb` | `c1072aae2fd4e0f323739e1058ca8404b1c2fdd4d708fa4d7016923f6d9b9c02` |
| `assets/survey-skimmer-cockpit-v1.glb` | `playable/assets/vehicles/survey-skimmer-cockpit-v1.glb` | `0970a9d51793e8ac826ed5a6e66d57774cbb891fd92296f4bbf03a34cb5e30eb` |
| `assets/terrain/basalt-albedo.png` | `playable/assets/environments/phase1/basalt-albedo.png` | `d31afc9865f08cbf84f4c4cd5a95a7e6aca5441271dc8764276c013ef8c8e841` |

裂翼兽可编辑 Blender 源与生成概念图继续留在仓库的 `playable/assets/creatures/riftwing-r11/riftwing-r11.blend` 和 [美术记录](../../docs/art/creatures/riftwing-r11/PROMPT.md)。Godot 的 GLB 导入会在 `assets/` 下抽取纹理 PNG；这些是导入器生成的依赖，不代表新美术。

## 连续行星与实体地表

`scripts/native_planet_field.gd` 逐式移植 `playable/src/planet/field.mjs` 的固定种子三维连续高度场。工程球半径 120,000 米，球心在原生场景 `(0,-120000,0)`；旧盆地原点仍在 `(0,0,0)`。`scripts/native_planet.gd` 以六个立方球面覆盖完整星球，不裁成六公里圆盘：每面 128 段的整球远景由 `scripts/native_planet_bake.gd` 从同一高度场离线烘焙为 `assets/terrain/planet-far-*.res`，轨道常驻且运行时不重建；玩家径向脚下的 7 级区域瓦片（约 117 米/采样）和 10 级近场瓦片（约 14.65 米/采样）流式替换远景。每个近场瓦片有与可见三角面共顶点的 `ConcavePolygonShape3D` 碰撞，脚底查询仅在实际碰撞在场时返回 `ready=true`。旧盆地 `height_at(x,z)` 继续保证原版 10 米三角值，背面/极点改用 `surface_at(scene_position)` 径向查询，不能用单值 Y 高度代表整球。

大陆尺度和路线来自 `docs/development/PLANET-MAP.md`：盆地周围是不规则约 85×72 公里大陆，向东 8 公里平原、17 公里森林、27 公里湿地、34 公里曲折海岸、42 公里海洋。海水由同一字段的 `water_height` 在粗/中/近瓦片上裁剪出独立可见网格，海床仍是固体碰撞；`water_depth` 供登陆安全判定。`planet_surface.gdshader` 用已在场瓦片覆盖纹理裁剪下一级粗网格，防止巨大粗三角穿出近景。`planet_water.gdshader` 给水面着色。原盆地继续使用既有紫色星云全景，远地地表降低雾密度、轨道关雾，避免把大陆和整球吞没。生态树、芦苇和河石由 `NativePlanetEcology` 按真实地表碰撞流式放置，模型来源和预算见 `assets/planet-ecology/manifest.json`。

World 对主场景提供 `planet_enabled`、`planet_radius`、`up_at`、`surface_at`、`is_solid_at`、`sweep`、`update_stream`，保存坐标转换见 `PLANET-NATIVE-CONTRACT.md`。长距离瞬移先反复调用 `prepare_route(from,to,radius,height)`：它每 70 米预取且短时固定路径附近的旧盆地块和球面近瓦片，`ready=true,clear=true` 只证明真实渲染与碰撞已具备，随后必须沿实际投影弧逐段 `sweep` 决定能否通行；完成或取消时调用 `release_prepared_route()`，10 秒超时兜底。跨瓦片边线的 ±5/25 厘米脚底足迹补射必须命中真实三角才能确认 ready。

可复验物理：`Godot --headless --path godot --script res://scripts/native_planet_probe.gd`。当前 11 个样点包括旧盆地、3/4/8/17/27/34/42 公里路线、背面及两极，真实三角 `ready` 全真，近场报告间距 14.648 米；42 公里海床约 -180 米、水深约 180 米。区域/近场瓦片的高度场采样由单个 worker 线程计算，主线程只逐块提交网格、碰撞和覆盖纹理；在场前不会虚报 `ready`。本机 11 点探针最慢一次 `update_stream` 约 24 毫秒，普通路线约 9–14 毫秒；这是本机调用耗时，不代表目标设备帧时间。Godot 4.6.2 editor 解析及主场景 headless 5 帧无报错；修改后长瞬移 6/6、球面存档与极点 21/21、原生主流程 52/52。

可复验视觉：`py -3 godot/scripts/native_planet_visual_capture.py segments05` 以 Intel UHD / OpenGL Compatibility 抓取九个真实地面物理样点、面向海岸和轨道视角，输出到 `godot/reports/planet-world-r2/segments05/`，脚本核对源码 SHA 在采样前后未变。`coast-east-overview.png` 可以看见 34 公里东向河口接大海，`coast-east-ground.png` 有近场岸地、树和远水面，`orbit-no-fog-diagnostic.png` 可辨陆海及完整球面；`route-34000-ground.png` 的山体经 LOD 着色诊断为真实中近景地形，不是远景穿模。轨道相机属于自由视角诊断，正常操控升空与返程仍需产品链路验证。地面美术沿用已有星球概念图与程序生态资产，远景地貌仍较概括。

2026-09-29 修复盆地上空约 1.6 公里的方形暗带：行星网格保留双面显示和双面碰撞，部分朝向从地表上方看到的是背面；原着色器没有把背面光照法线转回外侧，使区域瓦片明显暗于旧盆地。`planet_surface.gdshader` 对背面翻转光照法线，并在旧盆地边缘取相同玄武岩贴图和灰紫色值；旧盆地近景、远景网格和碰撞仍在场。盆地上空 300 米起预取 7 级区域瓦片，流式签名包含区域邻域半径；350–900 米连续降低原盆地雾密度，让陆地随升空显现。没有使用像素抖动遮盖边线。独立隐藏窗口的 Intel UHD/OpenGL 对位截图在 `godot/reports/planet-basin-normal-final/`：`default-pitch--0.35.png`、`arena-yaw-0.00-pitch--0.65.png` 及 `handoff-agl-100/350/500/700/900.png`；原问题对照在 `godot/reports/planet-basin-repro/`。九点大陆、海岸、背面和轨道截图在 `godot/reports/planet-world-r2/basinnormalfinal/`，采样过程源码 SHA 无变化。复验命令：`py -3 godot/tests/native_hidden_capture.py res://tests/native_planet_basin_visual.gd`；`py -3 godot/scripts/native_planet_visual_capture.py basinnormalfinal`。静态截图只验证渲染，正常物理升空过程仍需独立动态复验。

同日继续隔离高空短暗线与轨道小方块。逐层关闭截图 `godot/reports/planet-basin-line-isolation/` 证明暗线来自旧盆地 160 米近景块的 8 米下垂侧裙，而不是球面区域瓦片；完全去掉侧裙的诊断图 `planet-basin-line-no-skirts/` 证实线消失，但侧裙仍需在低空封住近远景高差。现于近景顶面保持原纹理、地面保留侧裙，并在相机高于 350 米时只裁掉侧裙片元。近景物理形状仅使用顶面三角形，不再把视觉侧裙当作隐形垂直墙。轨道上角色背后的高频大方块来自球面着色器把盆地细纹理扩展到 24 公里方形区域；该边缘匹配纹理在 9–30 公里相机高度渐退，原六公里盆地网格继续显示。静态同位图见 `godot/reports/planet-basin-geometry-final/line-all.png`、`handoff-agl-100.png`、`orbit-player.png`。

独立正常物理复验详见 `godot/reports/planet-native-r1-independent/BASIN-SKIRT-FOCUSED-REVIEW.md` 与 `GROUND-EDGE05-REVIEW.md`：原分辨率 1.6 公里竞技场暗横线已消失；350 米上下切换未见大洞，采集 1181 个连续渲染帧局部画面；约 100 米高空跨近景块与贴地跨真实 z=200 米块边时支撑始终就绪，贴地跨线前后速度连续、没有下穿。稳态绘制间隔 p95 约 17 毫秒（含截图读回），启动与首次视角切换仍有短峰值。新 World 源码下的原生完整升空—轨道—返程由 Player 验证 12/12，源码首末 SHA 一致；该记录在 `godot/reports/planet-native-player/`，具体运行时间和截图应以最新报告为准。`godot/reports/planet-orbit-patch-isolation/` 同位关闭旧盆地与整球远景后，角色上方剩余的小暗形在整个星球远景隐藏时仍完整存在，属于角色背部轮廓，不是地形小方块。轨道球缘浅色锯齿、盆地玄武岩高频颗粒及未遍历的坡地接缝仍需独立美术/抗锯齿改进；本次不声称所有视角无闪烁。

验证：Godot 4.6.2 headless 导入三份 GLB 成功；Godot 和 JavaScript 对营地、陨坑、阶岩、裂翼兽地点、边界附近及非网格点的六组 `height_at` 数值一致（最大差约 `10^-13` 米）；迁移脚本解析通过。真实 Godot 物理射线从上方击中营地与陨坑地面；陨坑三角碰撞与高度查询差约 `0.00004` 米（Float32 网格精度）。一次 headless 采样：启动生成远景及 11 个初始近景块约 240 毫秒，随后补满 81 个近景块的 80 次 `update_stream` 总计约 195 毫秒，单次最多约 6.4 毫秒；远景在移动时不重建。独立 Intel UHD/OpenGL 的[营地截图](../reports/native-camp-opening.png)与[800 米地平线截图](../reports/native-high-altitude-horizon.png)确认天空连续、星云/星点/行星可见，六公里远景覆盖画面且无明显接缝或深度闪烁。旧网页的船体内部、墙体、岩块、营地调查物碰撞不在这个地形模块内；要在对应场景模型迁入后一起接入，避免看不见的阻挡物。
