# 图12局部地质细节交付

2026-09-29。该切片已收敛冻结。仅新增 `godot/scripts/native_planet_regions_r3.gd`、`godot/assets/planet-regions-r3/`、`godot/tests/native_planet_regions_r3_visual.gd` 和本组 docs。两个 field 文件保持冻结；未改 world、planet、ecology、共享 shader 或任务。总控负责 world 接线。

## 接线接口

类 `NativePlanetRegionsR3 extends Node3D`：

```gdscript
var geology := preload("res://scripts/native_planet_regions_r3.gd").new()
add_child(geology)
geology.setup(planet) # planet: NativePlanet，且 setup_world 已完成
# 每次世界流送更新，先让 planet 更新，再调用：
geology.update_stream(player.global_position)
var diagnostics: Dictionary = geology.snapshot()
```

`setup(planet:NativePlanet)` 读取 `field.landmark_regions()`、载入两类各六变体/两LOD保存网格及私有材质。`update_stream(scene_position)` 读取 field 权重和方向，只对 cold/volcanic>0.2 的区域流送；所有实际锚点和皮层顶点要求 `rendered_visual_surface_at.ready`。不采用解析高度作为已加载地面。`snapshot()` 返回 patches/triangles/pending/kinds/colliders/anchors/rejected/max_build_usec 及预算。

冷区：依据已渲染面的坡度选陡壁，生成弯曲且边缘有缺口的覆冰面，附不同长短、棱面和根部位置的冰挂。冰挂的主轴顺岩壁向下，避免沿全球Y或径向垂落后埋入高度场。冰覆/冰挂属于视觉装饰，不增加独立碰撞。

火山区：坡度上限、横向凹沟检查和中心线逐行下降检查共同筛选真实低沟；窄冷却熔岩面逐顶点贴地，私有材质只给细裂隙微弱熔光。矿物沉积岩口为不规则多层开口网格；220m内只有 `surface_at.ready` 时添加 trimesh 碰撞。远处无岩口碰撞；无伤害、任务、新战斗特效或动态蒸汽。

流送范围 620m；超过 740m、离开两区或离地超过850m卸载。近LOD范围220m。每次更新最多尝试构建1块，最多42块、44,000三角、约84个可见MeshInstance；每次更新重验一个驻留块的地面所有权、LOD和碰撞状态，三角面变化后删除重建。不会在 mid/near 未加载处硬放。

## 实际验证

使用真正 `NativePlanet` 的近地块和碰撞记录，在独立测试场景同步加载，未替换地表查询成假返回值。未读取/改写玩家存档。

- [冷裂谷截图](planet-regions-r3-cold.png)：实际岩壁、覆冰面及不等长冰挂清晰可见。
- [火山矿带截图](planet-regions-r3-volcanic.png)：贴地冷却面和有凹口的矿物岩口清晰可见。
- [完整机器记录](planet-regions-r3-results.json)：6,934 checks、0 failures。包含未加载时零生成、每组预算、地表顶点支撑、岩口碰撞就绪与远离后完全卸载。
- 冷区26块、12,544三角；火山区42块、14,836三角、11个就绪岩口碰撞。
- 每块贴地网格近LOD135个实际地表采样顶点，远LOD45个；抽验每个三角的一个顶点相对真实面法向间隙在允许范围内，无失败。
- 本机完整构建尝试峰值12.654ms，属于加载时开销，**不能宣称无卡顿**。仅1块/调用，首次加载应逐帧渐入；总控不要在一次帧循环里额外多次调用以强制清空队列。
- 测试结束 SHA 证明冻结 field 未变：`native_planet_field.gd` = `3e2b934bb509f021e0f392a585c58e02953323e14060234bf39bc210a4e42af7`；`native_planet_field_r3.gd` = `27d1b8776bf245edc3a44ac6cd90e318be4a7442961775c02505df110e04cabc`。

复验/重拍命令：

```bat
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --path C:/Users/HUAWEI/.codex/worktrees/3ff0/star-abyss-game/godot --script res://tests/native_planet_regions_r3_visual.gd --rendering-method gl_compatibility
```

## 如实差距与总控验收

这两张是Godot实际截图，已通过view_image查看，但不能宣称达到概念图12的照片级冰岩/熔岩质量。覆冰仍有可辨的带状边缘和程序纹理；岩口为静态矿物地貌，未做动态蒸汽。火山截图背景的大面积红色曲线来自现有共享地形材质，不是本模块的窄冷却面或细裂隙shader；本session未越权修改它。总控应据实际截图统一控制背景熔光尺度。

最终主游戏仍需在真实角色机位确认：地面流送先后顺序、岩壁两LOD切换、近处岩口行走碰撞、离区卸载、与ecology晶体/浮岩模块合用时的总draw call/帧时间。本模块未新增晶体或浮岩，不重复生态模块的资产职责。
