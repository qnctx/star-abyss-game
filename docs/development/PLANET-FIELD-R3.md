# R3 高度场与地理接口

2026-09-29。本 session 只修改 `godot/scripts/native_planet_field.gd`，新增 `native_planet_field_r3.gd` 和本页列出的 R3 专有测试/资料。未修改 native_planet、native_world、ecology、shader、WORLD、任务或存档。开始修改前逐字节备份到 [基线](planet-field-r3-baseline/native_planet_field.gd.txt)。codegraph 不在 PATH，改用 rg 精确检索。没有调用生成服务或产生新生图费用。

## 图片依据与已实现内容

实际查看已批准图册中的 01/03/04/06/07/08/12 原图。概念图是形态与地理关系依据，不当作可量测地图。

- 01/03：视觉 `basin` 为扭曲椭圆地理权重，独立于方形 `legacy_weight`。包含旧六公里全部核心，向约 8–10 km 外围衰减；外围保留数十公里开放低起伏平原。
- 04：北部连续山带、断续脊顶、纵向峡谷和山麓。起伏集中到山系，不再把整片大陆铺满等强度山丘。
- 06/07：6.5–35 km 主河使用同一单调下降水头，缓弯主槽、三条汇合支流、下游展宽和分流槽共用它。河床切进周边低地，35 km 接海平面；旧区不增加水。
- 08：东部陆架形成狭长裂岛链，陆块被水道分开；保留首路线 42 km 开放海域。
- 12：低温裂谷、火山矿带、镜晶峡谷、风暴高原分散在不同大陆位置，有明确高度形态和连续权重。裂谷有窄陡壁、坡脚台阶与岩层微起伏，火山有隆起和破火山口，高原有较平顶面和断层。

## 接口与坐标

种子仍为 `star-abyss-planet-v1`，半径仍为 120000 m。原 `sample(direction)` 字段保留，新增 `cold`、`volcanic`、`crystal`、`storm`，均为 0..1、局部紧支撑的平滑权重。这些是地理权重，不是任务完成状态，也不是已实现冰/熔岩/晶体/风暴效果的声明。地表主颜色由总控接这些字段。

`landmark_regions() -> Array[Dictionary]` 每项包含：

| 字段 | 约定 |
|---|---|
| id | cold / volcanic / crystal / storm |
| name | 中文地区名称 |
| reference | docs/art/planet-review-r3/12-special-regions.png |
| direction | canonical 单位径向 Vector3，可直接传 sample |
| canonical | direction × (RADIUS + 实际地表径向高度)，Vector3 |
| position | 游戏 scene Vector3：(-canonical.z, canonical.x - RADIUS, -canonical.y) |

不要把 `position.y` 当作海拔，曲面远处 scene y 为负是正常的。需要最新位置时查询方法，不要将下表四舍五入值写死。

| id | 地理中心 s/n (km) | 当前 scene 位置 x/y/z (m，约值) |
|---|---|---|
| cold | -38 / -35 | -36105 / -9822 / -34809 |
| volcanic | -56 / +16 | -54172 / -12469 / +16150 |
| crystal | -14 / +39 | -13274 / -6738 / +38425 |
| storm | -69 / -19 | -64963 / -19755 / -19073 |

`native_planet_field_r3.gd` 是 field 专用内部模块。`river_center(s)` 返回相对 `_route_z(s)` 的弯曲主槽偏移，当前约 520–1380 m；使用它采样主河，不再把旧的固定 320 m 偏移当作河心。`river_channel(s,cross)` 含主槽、支流、分流，均连续。首路线自身仍在 cross=0。

## 已运行回归

[机器结果](planet-field-r3-results.json)：8,037 checks，0 failures。

- 旧六公里采样网格与保存的原 field 实现相比，径向高度差 **精确为 0**，ownership=1，water_height=null；反投影原场景高度最大误差 0.015315 m，来自 Vector3 单精度。
- 总控补充要求后，将有机盆地的纯盆地核心半径由 0.48 调整为 0.60。旧六公里四角 `basin` 当前均精确为 1.0；仍只由扭曲椭圆计算，没有与方形 legacy_weight 取 max。重新运行全套回归并重拍诊断图。
- 首路线 4–42 km 每 50 m 采样，最大纵坡 0.096377（约 5.51°）；8/17/27/34 km 地面无淹水，42 km 海域水深大于 80 m。
- 主河 6.5–35 km 每 50 m 检查：水面单调下降、最低水深约 6 m；三条支流各沿上游 4.5 km 到汇合点每 100 m 检查湿床。
- 南侧约 24×9 km 开阔平原二维梯度采样最大 0.026434（约 1.51°）。
- 裂岛窗口检测到 312 个出露陆地样本和 622 个深于 10 m 的海水样本。
- 球面极点、反经线、立方体边方向两侧扰动高度差最大 0.068792 m；全球经纬网格高度有限，新增权重及盆地/旧区权重均在 0..1。
- 四处 landmark 均有峰值权重、位于陆地、远离旧区、scene/canonical 转换一致。

复验命令（cmd，从任意目录运行）：

```bat
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path C:/Users/HUAWEI/.codex/worktrees/3ff0/star-abyss-game/godot --script res://tests/native_planet_field_r3_verify.gd
```

## 视觉检查与剩余集成验收

`native_planet_field_r3_visual.gd` 实际用 Godot OpenGL 渲染同一个 field，输出后通过 view_image 查看全部六张图。初次检查发现河道过直、裂谷过圆滑，已修正弯曲/展宽、陡壁/台阶并重拍。最终预览：[大陆](planet-field-r3-continent.png)、[河网](planet-field-r3-river.png)、[低温](planet-field-r3-cold.png)、[火山](planet-field-r3-volcanic.png)、[镜晶](planet-field-r3-crystal.png)、[高原](planet-field-r3-storm.png)。

这些是**高度场诊断图，不是最终游戏品质截图**：用展开的经纬地理窗口、230 格网格和测试颜色，未加载原盆地模型；大陆高度夸张 3 倍、河网 6 倍、特殊区域 1 倍。图外矩形是诊断窗口边界，不是地理权重边界。大陆尺度下窄河可能因采样间距出现断续显示，数值连续不能解决渲染 LOD 漏采。真实游戏仍需总控在主 renderer 中核查河面连通、近处岩壁和旧区接边。

复拍命令：

```bat
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --path C:/Users/HUAWEI/.codex/worktrees/3ff0/star-abyss-game/godot --script res://tests/native_planet_field_r3_visual.gd --rendering-method gl_compatibility
```

本分工交付的是地形高度与查询接口。浮岩不能由单值高度场表达；冰挂、晶体模型、熔岩流/洞口、雷暴、材质和植被需要由对应集成 session 按已批准图落实。未把这些未完成效果冒称为已完成美术，也未越权修改对应文件。主游戏整合后应按首路线和四个 landmark 实机截图，检查岩层密度、特殊区辨识度、水岸 LOD 和碰撞；本页回归不替代该验收。

## 主游戏机位与最终指纹

以下 scene 机位面向 `landmark_regions()` 返回的对应 `position`，FOV=60°、far=30000 m。相机的 up 必须使用对应径向 up，不能在远处硬套 Vector3.UP。机位是方便总控做主游戏截图的建议，尚未宣称这些机位完成主游戏最终材质验收。

| id | camera.position (scene m) | look_at 的 up |
|---|---|---|
| cold | (-34265.68, -7405.707, -35326.82) | (-0.298249, 0.910145, -0.287549) |
| volcanic | (-52741.97, -9750.801, 16389.21) | (-0.445919, 0.885146, 0.132939) |
| crystal | (-10989.71, -4752.983, 38999.28) | (-0.110309, 0.941209, 0.319309) |
| storm | (-63831.97, -16903.79, -19357.03) | (-0.537032, 0.828695, -0.157673) |

实际 API 使用示例（field 为 NativePlanetField 实例）：

```gdscript
for region: Dictionary in field.landmark_regions():
    var sample: Dictionary = field.sample(region.direction)
    var d: Vector3 = region.direction
    var up := Vector3(-d.z, d.x, -d.y)
    var east := Vector3(d.x, d.z, 0.0).normalized()
    camera.position = region.position + up * 1800.0 + east * 2500.0
    camera.look_at(region.position, up)
    # region.canonical is the same ground anchor in canonical coordinates.
    # sample[region.id] is this region's 0..1 geographic weight.
```

2026-09-29 最终 SHA-256（certutil 实际计算；没有提交其他 session 的并行改动）：

| 文件 | SHA-256 |
|---|---|
| godot/scripts/native_planet_field.gd | `3e2b934bb509f021e0f392a585c58e02953323e14060234bf39bc210a4e42af7` |
| godot/scripts/native_planet_field_r3.gd | `27d1b8776bf245edc3a44ac6cd90e318be4a7442961775c02505df110e04cabc` |
| godot/tests/native_planet_field_r3_verify.gd | `f43232373e827b32b29cf34b1735ae9721858043917cdd43441fc2e14b40c4b6` |
