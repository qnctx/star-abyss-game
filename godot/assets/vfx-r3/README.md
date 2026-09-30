# 武技特效 R3

状态：已根据既有生成图完成 7 个本地 Blender 派生资源及 R3 接口，资源版本为 `r3-existing-reference`。没有新增生图或付费 3D。本轮新增五种武技分镜尚未获批，因此下文逐项说明既有图派生关系，不声称拥有新分镜。此目录与 `scripts/native_vfx_r3.gd` 由 VFX 会话维护。主场景、武技判定、角色和动作驱动由各自所有者集成。

## 资源与时序设计

| 武技 | 蓄势骨点 | 释放形状 | 命中反馈 |
| --- | --- | --- | --- |
| R4 拳劲 | hand_r，右拳周围短螺旋收紧 | 前尖后空的压缩气劲，细长尾迹 | 沿命中法线的短促开口冲击冠 |
| R5 掌波 | hand_l，掌前双道细弧 | 中央留空的外张掌波 | 较宽、短寿命的薄弧扩散 |
| R6/R7 横扫 | hand_r，细弧贴合挥手 | 水平新月刃和两道短回声 | 与来向一致的切线冲击 |
| R8 下劈 | hand_r，举手蓄势 | 竖向下劈刃，沿瞄准路径脱离 | 竖裂线与薄地面弧 |
| R9 裂空 | hand_r，双臂动作由 motion 提供 | 锐细分叉缝线，保持中心透明 | 三条断续裂空弧，短促扩张后消散 |

来源于 R2 的诊断：`launch()` 只取一次手点且额外前移 0.45 m；高阶 `launch_tier()` 在目标处直接生成，因此无法表达本轮要求的“跟骨蓄势→从对应肢体脱离”。R3 改由武技动作事件显式触发释放和命中，VFX 不计算伤害、不替代碰撞、不自行猜测释放帧。

已实现并与集成契约统一：`begin_cast(realm, profile, socket_transform, target)`、`follow_socket(socket_transform)`、`release(socket_transform, target, travel_seconds=0.12)`、`impact(position, normal=UP, hit=true)`、`cancel()`。一个实例一招，自身 `_physics_process(delta)` 推进；调用者不可再手动 advance。`profile` 可直接传 `NativeMotionR2.cast_profile(realm)`，读取 `action_id` 或 `action` 并统一 `air_` / `cast_` 前缀；未给动作时按境界选形。未来若使用近战独立变体，可传 `action_id` 为 `palm/sweep/cleave`。`debug_snapshot()` 和 `visual_event(serial,phase,details)` 提供当前世界源点、释放源点、释放帧、实际 delta 和资源版本。取消立即隐藏并移除；正常释放后自动释放实例，R9 2.2 秒蓄势受支持。

真实命中由 Main 判定并传 `hit=true` 才显示目标爆散；落空传 `hit=false`，仅将飞行形态在 85ms 内消散，不显示命中亮斑。省略第三参数仍默认 true 兼容旧调用。`debug_snapshot` 的 `missed` / `impacted` 区分两种结果，`visual_event` 分别发 `miss` / `impact`，均幂等。

动作所有者确认 palmR 掌面外法线为 `-socket.basis.x`，palmL 为 `+socket.basis.x`，骨局部 `+Y` 指向指根。蓄势涡流按这些真实轴随掌翻转，握拳按 `+Y` 聚气；释放刃面仍朝准星，不由手腕扭转改变伤害/弹道。`debug_snapshot().actions[].charge_normal` 可观测此法线。

## 渲染约束

- 资源依据 `reference-r2.png`，它是已经生成的 `assets/vfx-r2/reference.png` 原样副本。该图覆盖手部收束涡流、开口新月气刃、细丝爆散三阶段；R3 在此语言上派生拳/掌的宽窄和横/竖朝向。来源 SHA256、每个资产的图像依据、部件名和三角数见 `manifest.json`。每个 `.blend` 内封存相同参考图。
- 单效果最多 3 个主要网格层；不使用实体圆盘、立方体、满屏光罩、关闭深度检测或全屏后处理。
- 透明无深度写入、保留遮挡；UV 边缘羽化、细尾迹与近镜头渐隐。只有命中峰值使用白芯，其余以低亮青色或高境界淡金/紫色区分。
- 不使用持续粒子发射器；碎屑以同一网格批次表达，生命周期有界；目标每招不超过 2,500 三角形。
- 蓄势阶段每次骨点更新只修改变换；脱手后不再追随玩家；打断要明确取消残留。

本地重建命令：`D:\blender\blender.exe --background --python godot\assets\vfx-r3\build.py`。可编辑源在 `source/`（有 `.gdignore`，Godot 仅导入 GLB）。每资源一个 mesh surface，三角数：charge 192、fist 336、palm 288、sweep 336、cleave 288、skyfall 480、impact 384。最复杂整招合计 1,056 三角；不用粒子发射器、动态灯光、阴影或屏幕采样。共享 shader 和 PackedScene 缓存，单招最多 3 次特效网格提交；实际场景其他模型提交不计入这项预算。UV 羽化与近镜头渐隐由 `qi_ribbon.gdshader` 控制，透明深度检测保持启用。

完整场景首次观察与独立验收均发现细弧在明亮地面背景中偏弱，首次亮芯调整不足以支持可读性通过。第二轮将主要弧宽提高约 1.8 倍、蓄势弧宽 2.4 倍、蓄势强度峰值 0.85、高阶主裂纹宽提高到 0.085 m；仍保留开口和羽化，不新增三角。最终人物 GLB 稳定后，默认第三人称已能辨认 R4 手部气劲、R5 掌波、R6 宽弧、R9 分叉裂纹。R8 曾因竖面边朝后方镜头失败，最终将带面宽轴转为 X 并在 XY 保留新月弯曲，成为可见竖向弧刃。释放帧从骨点原点开始，前最多 34ms 保留在源点，让较低渲染帧率下也有机会看到脱手，再加速到权威命中时刻；此变化不改伤害或命中时刻。

## 资料来源

- [Riot Games: Visual Effects](https://www.riotgames.com/en/artedu/visual-effects)：以施法动作和来源为中心表达游戏状态，控制细节与可读性的平衡。
- [Riot Games: VALORANT Shaders and Gameplay Clarity](https://www.riotgames.com/en/news/valorant-shaders-and-gameplay-clarity)：透明重叠和大面积填充有明显成本，特效需单独验证；本项目采用薄轮廓和开口结构。
- [Bandai Namco: DRAGON BALL Sparking! ZERO Gameplay Showcase](https://en.bandainamcoent.eu/dragon-ball/news/dragon-ball-sparking-zero-gameplay-showcase)：官方动漫 3D 战斗风格参考。此处只用于动作与气劲叙事方向，不复制角色或资源，不据网页文字声称完成逐帧视频研究。
- [Godot 4.6 spatial shader reference](https://docs.godotengine.org/en/4.6/tutorials/shaders/shader_reference/spatial_shader.html)：使用 `depth_draw_never` / `blend_add`，不关闭深度测试。

## 验证边界与试玩步骤

集成由 Main/Ascension 会话接线，不宣称完成实际手感验收。`verify.gd` 的实际 232 帧检查通过：蓄势跟骨/掌面旋转、无自主提前释放、释放点正确、脱离后不追人、释放/命中各一次、落空无命中爆散且短消散、自然清理、管理器 6 招上限、取消、无效骨点拒绝、R9 长蓄势、单招实例自动释放。记录位于 `verification.json`。执行命令：`D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --script res://assets/vfx-r3/verify.gd`。`capture.py` / `preview.gd` 用真实物理 delta 生成本地正常时间渲染证据，不模拟键鼠试玩。

独立验收会话另行复测 `reports/r3-independent/vfx_contract_probe.gd`，10/10 通过，证据 `reports/r3-independent/vfx-contract.json`。首次发现 `cast_sweep` 前缀可能回退拳形，已修复并增加 10 个动作命名变体回归检查。此结果仅为模块契约验收，不外推完整场景或 R3 美术。预览动作由独立 `_physics_process(delta)` 驱动，不在 PNG 写盘时手工推进或冻结时钟。

`py -3 godot\assets\vfx-r3\capture.py --main` 调用当前 `NativeMain._try_r3_cast()`，使用独立测试档，全场景/角色/敌人保持真实物理更新，输出 `evidence/full-world/`。观察器每帧记录实际 delta、墙钟、骨点、特效源点与事件；每轮重置测试敌人血量，防止后续境界对死敌和极远空点的截图误导视觉判断。它是自动主路径证据，不是实际键鼠试玩结论。

最终证据按独立目录保存，避免多次采图遗漏某帧时混看旧 PNG：`capture-20260927-214156/` 为 15 招空中默认/空中侧视/地面默认的 2,106 个物理采样；此轮 R8 确认未过。`capture-20260927-214517/` 为最后 R8 弧面修复的三视角 564 个采样，替代前轮 R8。每个目录的 `capture-inputs.json` 记录采集前后脚本与 GLB SHA，`stable=true`。未加时间戳的根目录图片和 `capture-20260927-214404/` 是历史诊断，不作为最终造型证据。`release-sha256.json` 是最终交付 SHA 清单；原始概念图仍为已有 R2 图，并未生成新五招分镜。

截图采集在 Intel UHD OpenGL 上会因 GPU 读回及 PNG 写盘变慢，首次 1,404 物理采样虽 delta 均为 1/60、time_scale=1，部分招式墙钟仍为模拟时间的 1.2–1.5 倍。因此另用 `capture.py --main --no-png` 保持真实渲染但不读回图片，记录帧号/墙钟到 `evidence/full-world/baseline/`；用 `summarize.py --main --no-png` 汇总。这项结果才用于判断正常速度，不能把固定物理 delta 当渲染帧率。

无 PNG 基线 `baseline/capture-20260927-214810/` 记录 15 招、2,106 个真实物理采样，版本均为 `r3-existing-reference`。VFX/角色/Player/敌人文件均稳定，但采集期间 Main 所有者更新了 `native_main.gd`，因此该轮整体 `stable=false`，作为研发观测而非最终整包冻结验收。Intel UHD / OpenGL Compatibility / 1280×720 完整场景的各招观察渲染均值约 **52.4–60.2 FPS**；多数模拟时间与墙钟接近，仍不宣称锁定 60 FPS，也不将整个场景负载归因于 VFX。视角/招式不同，全场景峰值 113–284 draw calls；特效自身预算仍最多 3 个网格面批次、1,056 三角。该采集在开发环境中进行，不是独占显卡或最低配置的正式性能认证。

**最终冻结基线：`baseline/capture-20260927-215413/`。** Main/Ascension 完成真实命中布尔转发后重新运行，`capture-inputs.json stable=true`、`INPUT_CHANGES=[]`。15 次发起、2,106 个真实物理采样，14 次释放/命中视觉，1 次地面 R8 被真实敌人打断（对应无残留；R8 完整释放已由单招三视角证据覆盖）。1280×720 Intel UHD OpenGL 的各招观察渲染均值为 **53.1–60.1 FPS**，默认空中第三人称约 53.1–60.1、默认地面约 56.6–60.1。完整统计在该目录 `summary.json`；此结果不等于锁定 60 FPS。最终主路径版本与资源 SHA 全部列于 `capture-inputs.json`，VFX 交付清单为 `release-sha256.json`。

源点审计在 `evidence/full-world/release-source-summary.json`。最终基线观察器持有特效实例直到真正自动释放，避免把 Ascension 在命中时主动清空句柄误读为“没有命中余辉”；历史采集的 `impacted=false` 仅反映句柄观测边界。主场景每次发生释放时的 VFX 源点与同帧真实手骨点差为 0 m（按输出精度），未自主构造人物中心或固定手前偏移。

独立最终可读性结论：R4 手部气劲、R5/R6 青色弧、R9 裂纹在默认背面第三人称可辨认；R8 旧版竖线问题已由 `reports/r3-independent/cleave-final-release.png` 与 `cleave-final.json` 单招复核关闭。独立报告确认 UTC 13:45:57 该 R8 捕获期间脚本/GLB 无变化且与最终新月版 SHA 相符，其他四招的先前最终证据继续适用。上述为视觉/同步验收，不是人工键鼠舒适度结论。

最终 hit/miss 转发后，独立会话另以完整主场景 300 个真实物理帧执行空招/命中双案例，10/10 通过：落空仅短消散且不扣血；真命中出现爆散并扣 28,000 生命。证据 `reports/r3-independent/hit-miss-final.json`、`hit-miss-final-audit.json`（UTC 13:55:22，源码采集期间稳定且与当前一致）。独立总报告 `reports/r3-independent/FINAL-REPORT.md` 明确保留人工手感等未测边界。

最终 VFX 代码 SHA256 `fb554f9ff173db5eefb0b4aac4aaace7af88ca292fd433774c4546b19b3b6872`；最终 R8 GLB SHA256 `dc7da2b7a37f2fd5c2ff43da17283cf4251790b25a2bf4ccd57deb279643f12b`；完整参考/源/资源清单 bundle SHA256 `603e0363771c9c30482bbae6ea9a19fefe2eb2d57b46c21db9fc349379a786ce`。

1. 地面、悬停各以 R4–R9 施法，核对蓄势跟随对应拳掌、效果只在释放帧脱离，人物轮廓仍可辨认。
2. 施法蓄势中转身或移动，检查气劲始终贴合手部；释放后移动，检查弹道不被角色拖走。
3. 施法蓄势中受击、瞬移或上车，检查残留取消且没有旧命中闪光。
4. 近身目标、远处目标、地面和天空分别测试；第一/第三人称检查近镜头特效不盖住视线，遮挡关系仍正确。
5. 连续施法后等待 2 秒，确认效果节点归零；对照正常速度视频检查释放、飞行、命中与动作连续性。
6. 对准天空或偏离敌人按 R：只能看到飞行后短消散；对准敌人命中时才有目标爆散，不能用落空亮斑冒充命中反馈。
