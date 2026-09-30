# Godot 原生迁移独立验收（2026-09-27）

本报告只记录独立验证实际触及的范围。验证脚本为 `godot/tests/native_verify.gd`，运行在 Godot 4.6.2、Windows、Intel UHD Graphics，原生项目位于 `godot/project.godot`。脚本只使用 `user://star_abyss_native_verify.json`，运行前后删除该独立档位；没有读写用户默认原生存档或网页存档。

下方 52 项基线和短时性能采样是前一轮迁移验收记录；本轮动作/VFX 改动的独立新增结果单列于文末，不能把旧 FPS 样本当作新动作的性能数据。

## 当前基线结果

运行命令：

```cmd
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --script res://tests/native_verify.gd --quit-after 900
```

当前集成版 **52/52 项通过，退出码 0，没有 Godot 脚本错误**。验收通过的实际路径：

- 主场景可解析并初始化；6km 盆地按需生成带 `ConcavePolygonShape3D` 的可见地形块，另有覆盖全盆地、着色器材质、超过 22,000 顶点与 130,000 索引的真实远景网格；边界地面/空中路径受限，高度查询有限值，流式可见块不超过 81 块。
- C2 角色导入 3 个网格与 1 套骨架；裂翼兽导入 2 个网格、1 套骨架、全部 10 个动画；勘探滑翔车导入 26 个网格。C2 的步行、飞行、拳脚与格挡由 `c2-motion.json` 驱动原生骨架，因此 C2 GLB 本身不带 Godot `AnimationPlayer` 动画。
- R4 低空巡航和加速上限均为 48m/s；350m 以上分别为 420/600m/s。原生骨骼 boost 混合权重达到 0.970，松开后回落到 0.029；骨盆姿态相差约 1.29rad。直接调用地面跳跃路径时角色离地且未进入飞行。此 CLI 探针不能合成 `Input.is_physical_key_pressed` 的真实硬件按键状态，Space/G 键位仍需窗口内手测。
- 同一裂翼兽在地面爪扑实扣 6,221 生命，从 2.2m 近距开始时停在约 2.050m 而不重叠；追随升空，再落地到地形。同一 actor 受到按动作接触时间结算的拳脚攻击后死亡，H 仅拾取 2 枚羽片；重开该独立档后死亡、拾取数量和信标调查保持一致。
- 兽在空中另用 sweep 击中角色；角色左拳延迟至动作接触帧才扣血。R8 空战术式加载真实 `void-fracture.glb`，聚势期兽不失血，释放帧扣 85,000 生命。
- R4 瞬移锁定；R6 短/长瞬移分别实际移动 12/60m、消耗 12/25 灵息并生成两处实模门户，冷却期间不移动也不扣费；R9 长距离 1,800m 可在盆地内完成，越界失败不扣费。境界与冷却随原生存档重开保持。
- 营地三栋原有 GLB 各有 8 个可见网格和 8 个真实三角碰撞体；角色以 `CharacterBody3D` 从指挥楼门外 `(-17,180)` 穿过开放门到 `(-17,172.1719)`，高度约 0.8072m。
- 勘探滑翔车可 F 上下车，实车底盘从原停车点行驶 0.545m，并在医疗楼实墙前 `z=179.7782` 停车；原信标调查可记录且不会重复计数。

## 零坐标存档与下车恢复专项

新增独立脚本 `godot/tests/native_recovery_verify.gd`，仅创建并删除 `user://star_abyss_native_recovery_verify.json` 及其 `.before-position-repair.bak`，不读取或改写用户的正常存档。运行命令：

```cmd
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --script res://tests/native_recovery_verify.gd --quit-after 1200
```

最终集成版连续运行两次均 **21/21 项通过、退出码 0**：

- 用玩家、滑翔车、裂翼兽三者全为 `(0,0,0)` 的旧档模拟损坏，启动后分别恢复至原始 `(0,190)`、`(72,80)`、`(1370,-1030)` 地点，旧 JSON 在 `.before-position-repair.bak` 逐字节保留，修复位置写回当前档。境界 R7、生命、灵息、兽生命 `123456`、羽片 9、两个已调查地标均保留。
- 恢复后的真实角色碰撞体沿地形移动 1.82m；普通合法的非零玩家、车、兽坐标保持原址。另一份非零但玩家与车重叠的模拟档，则把玩家移到附近安全位置并生成修复前备份，进度不丢。
- 在车的右侧加入实际 `StaticBody3D` 障碍时，下车改用左侧。把左右及前后四处候选落脚点全部封堵后，玩家保持乘车、隐藏状态及车辆镜头。
- 明确保存后销毁场景不会把三者坐标覆盖成零；重新加载后玩家、车辆、裂翼兽的位置和进度仍在。

## 原生画面核查

用同一脚本的 `-- --visual` 模式在 Intel UHD 的 OpenGL Compatibility 渲染器上生成 1280×720 截图，并逐张检查了角色关节和足底。截图是原生 Godot 画面，脚本直接设置动作姿态，故截图 HUD 中的“步行 / 0 米每秒”没有随姿态刷新；它不代表正常输入时的 HUD。

- [地面静立侧视](c2-ground-idle-side.png)、[步行侧视](c2-ground-walk-side.png)：静立双脚着地；1.8m/s 步行一脚承重、一脚摆动，未见明显骨骼扭曲或脚掌穿地。
- [加速飞行侧视](c2-boost-side.png)、[空中格挡侧视](c2-air-guard-side.png)：身体整体顺飞行方向前倾，护脸/护胸动作可辨。
- [左拳侧视](c2-left-jab-side.png)、[上挑腿侧视](c2-rising-kick-side.png)、[击飞侧视](c2-hit-launch-side.png)：伸臂、抬腿和后仰各有不同剪影，四肢未见明显脱节。

[集成版开场](native-camp-opening.png) 中三栋营地可见、角色无遮挡，中文 HUD 未裁切；紫色星云、细星点和环纹星球正常显示。[R8 虚空术式](r8-void-cast-third-person.png) 在原生第三人称镜头下清晰可见。

[离地 800m 俯视截图](native-high-altitude.png) 中，远景盆地已经填满地平线以下视野；先前的 720m 范围矩形硬边和紫色空洞消失，近远地形接缝没有明显闪烁。[离地 800m 朝地平线截图](native-high-altitude-horizon.png) 则显示环纹星球、星点和连续的星云渐变。早期原生天空曾出现三角硬片及水平断带，最终全景天空截图里均未再见到。

## 有界 CPU 样本

脚本在暂停场景树的条件下，手动调用主逻辑/分块流式函数各 180 次，记录单次调用耗时。这只反映当前设备的 headless CPU 负担，**不是有窗口渲染帧率，也不能用于推断网页与 Godot 谁更快**。

| 位置 | 180 次总耗时 | 最慢一次 | 可见地形块 |
| --- | ---: | ---: | ---: |
| 营地 | 193.86ms | 6.78ms | 81 |
| F2 裂翼岭 | 204.79ms | 7.17ms | 81 |

F2 传送同步生成近处块的单次耗时为 34.54ms；若实机看到瞬间顿挫，应继续检查该峰值。

另可运行有窗口计时模式：

```cmd
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --path godot --rendering-driver opengl3 --disable-vsync --resolution 1280x720 --script res://tests/native_verify.gd -- --perf
```

它在游戏主场景真实渲染运行时预热 0.75 秒，再分别采样营地静止和 800m 定点悬停各 5 秒，输出 `NATIVE_FRAME_JSON`。本机 Intel UHD Graphics、OpenGL Compatibility、1280×720、VSync 关闭时，最终集成版得到：

| 场景 | 5 秒帧数 / 平均 FPS | 帧时间中位数 | P95 帧时间 | 最慢一帧 |
| --- | ---: | ---: | ---: | ---: |
| 营地静止 | 1738 / 347.5 | 2.803ms | 3.807ms | 16.049ms |
| 800m 定点悬停 | 1659 / 331.7 | 3.020ms | 3.674ms | 9.709ms |

这是短时窗口实测，不覆盖战斗、快速飞行或长时间运行；也不能与不同条件下的网页 FPS 直接比较。

## 边界与待最终回归

当前通过的是原生可玩切片，不等于完整网页游戏已经迁完。原飞船内部、部分营地调查物、岩块、其他载具与完整调查流程尚未在本报告内验证；浏览器存档不会与原生档互通。还需在窗口里按一次 Space/G、连续操控飞行与战斗，确认真实硬件输入和长时间手感；本报告的自动化与短时窗口采样不能代替这一步。

## 2026-09-27：碰撞、镜头、R2 动作与术式专项

独立脚本 `godot/tests/native_issue_regression.gd` 加载**真实 Godot 主场景与导入资产**，只用并清理 `user://star_abyss_issue_regression.json`。运行：

```cmd
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --script res://tests/native_issue_regression.gd --quit-after 1200
```

最终集成文件 **9/9 项通过、退出码 0**。R2 C2 主场景只有一套可见动作驱动骨架，骨数 19；角色从 `(-14,182)` 向指挥楼侧墙连续前进，地面止于 `z=178.2903`、低空飞行止于 `z=178.2222`，没有穿过约 `z=176.5` 的实墙。第三人称相机在墙前缩短约 0.12m，末端球形查询无交叠；裂翼兽翼膜附近的相机也未进入摄像机专用碰撞体。角色触地会清除残留飞行状态；灵息低于 25 时无法起飞，达到 25 后按住 G 可再次起飞，C 下落优先；受控降落后再次起飞通过。

用 `D:\Python\python.exe godot/tests/native_hidden_capture.py` 在**不显示、不会抢焦点的 Win32 父窗口**中运行同一真实主场景的 OpenGL Compatibility 渲染，得到 1280×720 的 12 张独立截图（全部保存成功）：

- 镜头/碰撞：[现存档坐标模拟视角](issue-signal-saved-pose.png)、[营地墙边相机](issue-camp-wall-camera.png)、[裂翼兽正面](issue-riftwing-clear-front.png)、[翼膜附近相机](issue-riftwing-camera-near-wing.png)。
- C2：[静立侧视](issue-c2-idle-side.png)、[慢走侧视](issue-c2-walk-side.png)、[疾跑侧视](issue-c2-sprint-side.png)、[加速飞行第三人称](issue-c2-boost-third-person.png)、[加速飞行侧视](issue-c2-boost-side.png)、[空中移动左拳侧视](issue-c2-moving-jab-side.png)。
- 术式：[R4 气刃](issue-r4-air-cast.png)、[R8 虚空术式](issue-r8-air-cast.png)。两帧对应的实时效果分别载入 4/13 个真实网格。

本次静帧中，地面步态和整体前倾的加速飞行轮廓连贯，未见明显脱节四肢。模拟当前存档的 `(-140.2397,3.27444,-329.9384)` 视角右侧出现大块**有岩石纹理的近距离坡面**，C2 本体完整；它说明相机靠近地形会造成类似巨大三角区域，**不能据此断言用户原截图的唯一成因**，因为缺少原截图的精确视角与当时姿态。翼膜近距时相机缩到约 `(0,0.13,0.52)` 并暂时隐藏角色，避免翼片盖住近裁剪面，但有短暂第一人称感。R4/R8 的这两张独立截图目标较远，效果在画面中较小，因此只证明主场景资产和渲染路径接通，不能凭它们单独判定术式美术已达到预期；另已查看实现者的[近距 R8 主场景帧](r2-main/11c-r8-cast-close.png)，可见裂隙光弧。静帧和 9 项确定性检查仍不能代替连续键鼠操控、长时间空战手感或对所有地形墙面的穷举验证。

## 2026-09-27：全身格斗连续画面独立复核

独立脚本 `godot/tests/native_combat_sequence.gd` 在**真实主场景**加载导入的 C2 动作 GLB，用隔离档 `user://star_abyss_combat_verify.json` 和隐藏的 OpenGL 窗口取证；测试后删除隔离档，不碰用户窗口和默认存档。旧版动作 GIF 仅用于定位旧问题。首次捕获 [6 条片段的清单](native-combat-sequence/manifest.json)共 **318 帧 / 动作时钟 10.6 秒**：三连击分别有[正面](native-combat-sequence/review/combo-front.gif)、[侧面](native-combat-sequence/review/combo-side.gif)、[斜侧面](native-combat-sequence/review/combo-three-quarter.gif)各 60 帧，另有[移动左拳](native-combat-sequence/review/moving-jab-three-quarter.gif) 42 帧、[格挡/受击](native-combat-sequence/review/guard-and-hit-side.gif) 48 帧、[空中拳击](native-combat-sequence/review/air-melee-three-quarter.gif) 48 帧。逐帧动作状态依次观察到左拳、右拳、上挑腿；移动/空中拳的对应动作也被触发。静止三连击里的髋肩转动与出拳收手比旧版整块下身静止的动作明确改善，未见骨骼脱节。视觉检查使用有序隔帧时序图与关键原始帧，不能单凭它们宣布整体格斗“自然”。

**时基纠正：**首次 318 帧及第一次“修后”48 帧在渲染帧回调中手动调用 `_step_ground(1/30)`；`move_and_slide()` 使用引擎实际物理步长，当时未证实它也是 1/30 秒。故这两批片段只能证明姿态顺序和动作链，**撤回**其中关于物理移动距离、速度、脚滑和受击自然度的验收结论。修前 [第 34 帧](native-combat-sequence/guard-and-hit-side/f034.jpg)到第 38 帧的双腿前伸仍是可见问题线索，但阴影间隔不能证明脚离地。先前 [after-hit-fix](native-combat-sequence/after-hit-fix/manifest.json) 片段保留作历史记录，不作为正确物理时基证据。

最终只重拍必要的受击段：将引擎物理频率设为 **30Hz**，每次在真实 `physics_frame` 中调用运动逻辑；[日志](native-combat-capture.log)于第 0/10/30/34/38/40 帧均记录 `Engine.is_in_physics_frame()=true`，`engine_dt=manual_dt=0.0333333333333333s`，退出码 0。[本次 48 帧清单](native-combat-sequence/after-hit-physics-30hz/manifest.json)、[正常速度 GIF](native-combat-sequence/after-hit-physics-30hz/review/guard-and-hit-side.gif)与[隔帧时序](native-combat-sequence/after-hit-physics-30hz/review/guard-and-hit-side-strip.jpg)显示角色受击后后仰、脚保持着地并回正，没有旧片段的双腿前伸悬坐形态。第 34/38 帧实际速度 `2.27 → 0m/s`，玩家物理 `y=0`、踝骨约 `y=0.14m`；`apply_hit` 的 1000 点模拟冲击使生命 `155520 → 155270`（格挡减伤 75%），撤防再中一次后为 `154270`。本次启动 UTC `2026-09-27T12:45:10.821903Z` 及 Player、动作驱动、GLB 的完整 SHA-256 存于 [version.json](native-combat-sequence/after-hit-physics-30hz/version.json)，不与旧版文件混同。

**仍未通过的视觉项：**当前 C2 网格的手在拳接触时半张开，且没有手指骨骼；仅修改腕部轨迹无法呈现明确闭拳。等待该美术问题处理后须在主场景重新取近距接触帧验证。正确物理时基下只重拍了受击段，其他旧片段不能当作修后 Player/驱动文件的物理动作回归。画面中的两次受击使用真实 `NativePlayer.apply_hit`，但伤害方向和数值由测试注入，未模拟实际裂翼兽攻击接触；连续硬件键鼠操作及玩家手感亦不在本次自动捕获范围。

可复拍命令（真实 30Hz 物理帧，只录受击且不覆盖旧图）：

```cmd
D:\Python\python.exe godot\tests\native_hidden_capture.py res://tests/native_combat_sequence.gd --guard-physics
D:\Python\python.exe godot\tests\native_combat_review.py godot\reports\native-combat-sequence\after-hit-physics-30hz
```
