# C2 原生动作 R2 与气刃 R2 · 2026-09-27

> **当前走跑已更新为 R6**：基于批准的四张参考重作 walk/jog/sprint，交付 51 骨/29 片段 Blender 与 GLB；其余 26 片段及网格/绑定保留。见 [R6 交付、预览与复测](gait-r6/README.md)及[独立验收](gait-r6/independent/FINAL_REPORT.md)。手部和战斗沿用 [R3-MOTION.md](R3-MOTION.md)。下文保留 R2/R3 历史，旧步幅、骨数、采样率及录像哈希不代表当前走跑。

本切片由 Astra 在 `C:/Users/HUAWEI/.codex/worktrees/3ff0/star-abyss-game` 完成。仅修改两个新资产目录与 `native_motion_r2.gd`、`native_vfx_r2.gd`。没有改旧 `c2-motion.json`、`native_player.gd`、`native_main.gd`、浏览器资产或存档，也没有关闭、重启或操作用户试玩窗口。

## 交付与当前边界

- `reference.png`：第一张生成的动作设计板；`../vfx-r2/reference.png`：第二张气刃设计板。内置 imagegen，两次调用；批准批次已经用完，没有调用付费 3D 服务。
- `source/c2-motion-r2.blend` 与 `c2-motion-r2.glb`：原 C2 网格、装甲、纹理和 19 骨绑定，19 个 Blender 60fps 烘焙动画：原12个片段，加 combat_ready 与 air_jab/air_cross/air_kick/air_guard/air_hit/air_cast；Godot 导入采样率同步为 60fps。
- `../vfx-r2/source/qi-blade-r2.blend` 与 `../vfx-r2/qi-blade-r2.glb`：四层有厚度变化的渐细弧形曲面；非封闭圆盘。约 1.27 米宽，Godot 中施加 UV 边缘羽化、透明加色、不写深度、不投影。
- `../../scripts/native_motion_r2.gd`：原生动画混合、动作接触进度映射、全身冲刺与平滑侧倾。
- `../../scripts/native_vfx_r2.gd`：蓄势、定向释放、命中后消散；可与现有权威 windup 同步到达目标。
- `evidence/native-motion-orbit.gif`：实际 Godot OpenGL 渲染的 12 秒连续环绕与状态切换。`*-sheet.jpg` 是前/侧/后各 8 个时间点，不能代替整段手感验收。

**全身格斗重做已接入并完成本轮自动验证与原速取证；手套握拳形态尚未通过。主场景由 Sol 负责控制链，最终自然度仍须人工验收。** 本模块不能单独证明原截图黑三角已解决；相机故障证据由代码切片提供。地面普通速度6.8m/s使用jog（3.4m/0.5s），Shift 10m/s使用sprint（5m/0.5s）。R6–R9空战术式已有透明开口造型；瞬移门不替换。原19骨没有指骨，近景确认手套本身半张开，腕骨旋转无法闭拳。

## 格斗重做：依据、实现和待验收项

- 一手资料：[Shadow Fight 技术负责人 Evgeny Dyabin 的分离/补偿说明](https://80.lv/articles/separation-compensation-principle-in-strikes-animation)。落实为髋部先到驱动姿势、拳臂随后快速释放，以及踢击时支撑侧重心转移；不是让所有骨骼共用一个正弦包络。
- 一手资料：[Skullgirls 主动画师 Mariel Cartwright，GDC 2014 原始讲义](https://media.gdcvault.com/GDC2014/Presentations/Cartwright_Muriel_Animation_Bootcamp_Fluid.pdf)，已阅读正文与关键页。采用清晰预备/攻击/回收姿势、不同阶段速度、与玩法时长同步、连续回架势。没有把2D断骨夸张用于C2写实盔甲。没有声称已观看仅找到链接的官方视频。
- `combat.py` 独立编排全身：前后脚屈膝；jab/cross髋→胸→手的先后；非出拳手留在面部旁；kick先提膝、伸腿、收膝、落脚；hit保持脚下支撑。首轮侧面检查发现cross髋旋方向反了，纠正后重新导出。
- 驱动不再把静止出拳/踢腿的骨盆与腿覆盖为idle。地面支撑脚在世界空间锁定，运行时两段IK补偿有限根节点移动；kick仅锁左支撑脚。快移动必须由权威控制器先减速，腿长限制不能被IK消除。只有移动guard/cast继续叠加普通步态。
- 空中用六个独立air_*片段，不做脚锁。地面结束后保持combat_ready 0.8秒，连击共用收拳护头姿势。成功格挡时hurt计时不再将双臂强行切成hit。`dt=0`冻结视觉时钟，供Sol的命中停顿使用。
- 接触点仍为归一化0.38，`update_from_player`将权威windup映射到该点；资产时长不是攻击冷却的权威来源。主控限速、取消窗口、输入缓存、命中停顿由Sol负责。
- 新证据为 `evidence/combat/` 与 `evidence/combat-sequence/{front,side,three-quarter}-normal-speed.gif`。每视角包含地面jab→cross→kick、guard、hit、收势和空中连击，30fps原速；`*-sheet.jpg`便于检查逐帧剪影。旧orbit/directional/contact只代表旧轮次，不作为新版动作验收。
- GIF已读回验证：每视角155帧、5170ms，对应155/30秒。GIF的10ms精度用30/40ms交替编码，避免把33ms逐帧截为30ms造成加速；`evidence-manifest.json`记录当前模型、驱动和GIF哈希。
- `evidence/main-combat/` 为真实完整场景取证：`main-side-normal-speed.gif`、`main-three-quarter-normal-speed.gif` 是权威入口缓冲的空挥三连。最终距离对照是 `main-contact-2p3m-normal-speed.gif`（2.3m三连全落空）与 `main-contact-2p0m-normal-speed.gif`（2.0m三次真实伤害16500/16500/24000），各105采样帧/3.5秒。`events-contact-refresh.json`记录距离、实际serial、扣血帧与源码哈希，没有手动扣血或seek动作。独立save为 `user://star_abyss_motion_combat_sequence.json`，结束清理；AI和自动物理暂停，测试按30fps推进Main和玩家视觉，不能等同真人试玩。角色转向既有月光方便观察，未添加补光或修改材质。
- 接触修复：旧2.3m画面有可见间隙却扣血，Sol已将腕/踝到兽体包围盒的实际间距加入判定，拳0.24m、踢0.30m包含手套/靴子及容差。新同距测试确实落空，近到2.0m才命中。旧 `main-hit-side-normal-speed.gif` 与 `events.json` 的该命中段属于修复前诊断，已被两段距离对照替代，不能用于当前验收。包围盒加表面半径不是逐三角形精确碰撞；手形仍未通过，当前不宣称达到成熟格斗游戏自然度。
- 支撑测试进一步覆盖当前0.5/0.35/0.08m/s速度上限和取消窗口的连续三连，根前移约0.307m；允许最多14cm骨盆下沉以屈膝补偿，不伸长腿。左踝和踢击前的右踝漂移均小于0.001mm。踢击取消后等待90ms过渡再重新锁后脚，回到约0.14m踝高，避免把收膝脚锁在空中。长距离连续移动仍须控制器制动，不能无限锁在同一脚印。
- 受击专项纠正：独立画面曾出现双腿前伸后快速回直立；仅凭阴影不能证明“悬浮半米”。旧图缺少同版本足高trace，之后probe可能已载入修复驱动，不能混用结论。代码中确有超可达旧脚锚沿射线截短的风险，现先判断可达范围，越界释放并重新接地；16m/s异常根位移回归最大踝高约0.14015m。真实离地用支撑高度差>0.08m选择air_*，低于物理落地吸附阈值，防止提前抓住半空脚印。
- `evidence/hit-regression/pre-impulse-fix-summary.json` 仅保留早期诊断，不作为有效轨迹基准：该版harness在渲染帧调用move_and_slide，而重力按1/30秒推进，内部位移实际用了另一时长，旧AGL数字作废。它也不代表旧截图的足高。重复冲量机制另经Sol物理回归确认修复。最终 `hit_sequence.gd` 使用真实30Hz physics_frame，并记录engine_in_physics/engine_physics_dt；同场景trace需与 `provenance.json` 的driver/player/main哈希一起阅读，只重拍格挡、普通hit、launch。
- 修后 `hit-regression/summary.json`：108帧均在真实物理帧且dt=1/30秒；普通1000伤AGL始终0、最高6m/s、踝高最高约0.14015m；格挡1000伤AGL0、最高1.5m/s。强6221伤真实腾空最高约0.9718m，使用air_hit，恢复期air_guard持续护头，落地接combat_ready。原速GIF为 `guard-impact-launch-normal-speed.gif`（108采样帧/3.6秒）；trace记录root_y/support_y。切换30Hz后先完成一轮引擎帧，避免第一帧仍读到旧60Hz缓存dt；校验脚本对全段物理时基做断言。
- 手部评估：原网格无可独立控制指节，现有半张开手形在近景呈爪状。向总控提出仅1张C2手套闭拳/半握三视图参考，随后本地Blender仅重做双手、保留袖口/盔甲/材质；尚未批准，不生成、不调用付费3D服务。当前全身与手形结论分开记录，不能称格斗美术全部完成。

新增复验：运行 `combat_verify.gd`，再以 `capture.py res://assets/motion-r2/combat_preview.gd` 和 `capture.py res://assets/motion-r2/combat_sequence.gd` 渲染，最后运行 `combat_sheets.py`。正常速度看完三视角连击，重点检查接触时手腕/肘、另一手护头、左支撑脚、提膝收膝和接续姿势；主世界还须核对真实命中扣血、减速距离、受击取消、格挡不垂手。数值脚锁测试只证明踝点，不证明鞋底旋转无滑动或手形自然。

完整场景复拍使用 `capture.py res://assets/motion-r2/main_sequence.gd`，再运行 `combat_sheets.py` 与 `evidence_manifest.py`。若主控时序再改，只重拍受影响段，不把旧证据混入新结论。

仅接触距离复拍使用 `capture.py res://assets/motion-r2/main_hit_sequence.gd`（2.3m与2.0m）。仅受击复拍使用 `capture.py res://assets/motion-r2/hit_sequence.gd`，随后 `hit_sheets.py`；该脚本对真实物理帧与1/30秒时基断言，检查通过才使用其高度结论。

## 调查与修正

1. 原模型身高约 1.85 米；全部三个可见蒙皮网格权重归一化正常。`source-audit.json` 记录原始轴向、网格包围盒与权重。导入器附带的未绑定 Icosphere 骨骼显示辅助物没有进入新导出。
2. 旧原生驱动主动改成 canonical rest 与 inverse binds，并额外处理肩肘腕轴向；这需要作为一个整体验证，不能把不同骨骼坐标系的四元数直接混用。此行为本身不是已证实的黑面根因。
3. 新驱动完全保留 GLB 原始休息姿态和逆绑定。Blender 中先构造 Y-up 目标骨链，再转换为 Blender Z-up 与每根骨骼原始轴向，烘焙后由 Godot AnimationPlayer 播放。全身前倾仅在 pelvis 中施加一次；父 Model 不再追加前倾。
4. 首次制作时发现父骨骼更新滞后导致首帧折叠；逐级刷新后重导并重新取证。旧失败画面已被最终取证覆盖，未作为通过证据。
5. 步行采用两段腿长解算与交替支撑/摆动脚目标，随后对真实蒙皮后的最低足底校正。最初约 1.4 cm 穿地，修正后每个步行帧最低点的累计最小值为约 -0.000000079 米。
6. 拳脚以归一化 0.38 为接触点，前后有预备与收势；`update_from_player` 将权威 windup 映射到该点。受击、格挡是独立片段。最终模块手动推进 AnimationPlayer，再按 90 ms 地面/160 ms 空中窗口混合完整姿态，避免切换时下身突然立正。
7. 真实主场景取帧曾暴露拳击偏侧。新版世界空间手臂IK瞄准肩前约0.468米、向身体中线约0.065米；该方向检查不能代替手形、肩髋和全身连贯性检查。
8. 每个跑步周期有短支撑与腾空回收腿，脚后移速度与实际位移匹配。导出从零帧开始，移除曾导致脚滑的 1/30 秒首帧停顿；导入从默认 30fps 改为 60fps，10 m/s 的支撑踝漂移由约 52 mm 降至约 16.6 mm。
9. 基于 `owner_player.basis.inverse() * velocity` 获取方向：后退反向推进步态，相应侧移方向控制下身。新版攻击保留完整战斗姿势，移动guard/cast仍叠步态；空中独立片段。恒定动画轨道可能被导入器剔除，因此每帧先 reset bone poses 再采样，防止附加旋转累积；从不改 rest 或逆绑定。

## 总控集成说明（不要让两套骨骼驱动同时运行）

在现有 `$Model` 下实例化 `NativeMotionR2.new()`，隐藏或移除该容器里的旧 C2 实例。保留 Model 容器及另一会话正在修复的相机遮挡/近镜头隐藏逻辑。

把 `_update_visual(dt)` 内唯一一次 `_update_bone_motion(dt)` 替换为 `_r2.update_from_player(dt, self)`。旧驱动不要再调用，否则骨骼和攻击计时将重复推进。新适配器接管旧驱动内部的 `_attack_elapsed`、`_cast_elapsed` 计时与完成清理；不接管伤害、碰撞或输入。将旧 `_model.rotation.x/z` 的兜底前倾代码移除或设为零，新模块内部已经有前倾和侧倾。父 Model 的可见性仍由主脚本相机安全逻辑最终决定。

`contact_point_world(combo_index)` 纯读取当前实际腕/踝世界点（0=wristL、1=wristR、2=ankleR），空中同样可用。不seek、不延长手脚、不结算伤害；未ready时返回非有限Vector3，调用方必须拒绝。Main负责手套/靴子表面容差与兽体几何检测，并确保权威接触时刻与视觉帧一致。

最小接入片段：

```gdscript
# native_player.gd: add field; create after $Model is ready
var _r2: NativeMotionR2
# in _ready, after hiding the old C2 instance:
_r2 = NativeMotionR2.new()
_model.add_child(_r2)
# in _update_visual:
_r2.update_from_player(dt, self) # only once; adapter advances its own AnimationPlayer
_model.rotation = Vector3.ZERO
# retain the new safe camera and parent visibility code below it
```

`NativeAscension.spawn_air_cast(realm, origin, aim, windup)` 对全部 R4–R9 空战施法统一调用 `launch_tier`，与当前主场景接入保持一致。不要同时加入旧 `_effects` 数组，否则会二次缩放/移动；瞬移门仍走原有独立路径。

```gdscript
var tier := 9 if realm >= 9 else (8 if realm >= 8 else (6 if realm >= 6 else 4))
var effect := NativeVfxR2.new()
add_child(effect)
effect.launch_tier(tier, origin, aim, windup)
_active_cast_vfx = effect
_active_cast_contact_time = windup
return true
```

`launch_toward` 在手前 0.45 m 生成，蓄势占 windup 的 35%（最多 0.18 s），在权威 windup 时到达 aim，然后 0.15 s 淡出。碰撞方可提前调用 `impact()`；视觉模块不自行结算伤害。实际准星目标和命中必须继续由现有战斗系统提供。

统一入口 `launch_tier` 在低于 R6 时内部调用 `launch_toward`；R6/R7 为开口弧环，R8 为纤细分叉裂隙，R9 为分段道环。三个新 GLB 从同一已批准气刃参考的释放/消散形态派生，由同一个 Blender 脚本生成，未再生图。全部 UV 羽化加色、无深度写入，距离镜头 0.65–1.6 m 淡出；高阶效果在目标处蓄势并在接触后 0.25 秒消散。它们只替换空战施法，不替换瞬移门。

完整主场景发现高阶效果最初被兽身和地形遮住（aim 位于兽脚上方约 0.76 m，着色器强度约 0.99，并非缺 UV）。最终仅将高阶子网格上提 0.9 m、尺度改为 R6 1.4 倍/R8–R9 1.5 倍，最大外轮廓约 4.4 m，但仅有细薄透明开放曲面；权威目标 Node 位置不变，仍启用深度测试，不穿透墙体显示。`../vfx-r2/evidence/full-world/11-*.png` 与 `11b-*.png` 是最终正常深度下的完整世界画面。`depth-disabled-*.png` 仅是定位遮挡时的对照诊断，不是最终实现。

## 可复现命令

均在上述工作树根目录运行。Blender 路径为 `D:/blender/blender.exe`，版本 5.2.1。`source/.gdignore` 防止 Godot 再次自动导入 .blend，游戏消费显式 GLB。

```cmd
D:\blender\blender.exe -b -t 2 --python godot/assets/motion-r2/build.py
D:\blender\blender.exe -b -t 2 --python godot/assets/vfx-r2/build.py
D:\blender\blender.exe -b -t 2 --python godot/assets/motion-r2/verify.py
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --editor --import
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --script res://assets/motion-r2/transition_verify.gd
C:\Users\HUAWEI\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe godot/assets/motion-r2/capture.py
C:\Users\HUAWEI\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe godot/assets/motion-r2/capture.py res://assets/vfx-r2/preview.gd
C:\Users\HUAWEI\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe godot/assets/motion-r2/sheets.py
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --script res://assets/motion-r2/directional_verify.gd
C:\Users\HUAWEI\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe godot/assets/motion-r2/capture.py res://assets/motion-r2/directional_preview.gd
C:\Users\HUAWEI\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe godot/assets/motion-r2/capture.py res://assets/motion-r2/contact_preview.gd
C:\Users\HUAWEI\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe godot/assets/motion-r2/capture.py res://assets/vfx-r2/high_preview.gd
C:\Users\HUAWEI\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe godot/assets/motion-r2/extra-sheets.py
```

capture.py 使用未显示的 Win32 父窗口、原生 OpenGL 子窗口和独立 SceneTree；不抢焦点、不触碰存档。第一版捕获器因没有泵送父窗口消息而超时，仅自己的子进程被终止；最终版本已修复并成功完成取帧。

## 验证结果与具体手测步骤

- `deformation-report.json`：覆盖19个片段全部1099个烘焙帧，所有可见蒙皮顶点有限，最大模型跨度小于3m，最长网格边约0.305m。该检查只筛查异常拉伸，不证明动作自然或任意世界相机位置安全。
- `transition-report.json`：Godot 4.6.2，13 个状态、780 帧、19 骨；绑定保持不变，第一人称隐藏正确，气刃正向移动、碰撞停止、生命周期释放、权威接触时刻到达检查通过。
- 另以真实 NativePlayer 数据对象（不进入世界、不运行存档）检查适配器：攻击 windup 精确映射到 0.38 接触姿态，攻击及施法完成标志按时清理，避免美术切换后卡住战斗状态。
- `directional_verify.gd`：实际6.8/10m/s × W/S/A/D的片段、步频、步行脚漂移；新版改查拳击骨盆确实参与发力、低速各方向接触仍朝前，不再断言攻击必须复制普通跑步腿。`combat-report.json`独立记录根节点小幅平移时的支撑踝、空中片段选择、hitstop及rest不变；不作艺术质量结论。
- 原生 OpenGL/Intel UHD 实际渲染：288 张动作多视角时序画面、360 张连续切换环绕画面、720 张实际速度方向/混合画面、24 张 R4 气刃释放画面、72 张高阶效果普通/斜视/镜头进入时序画面。方向动画在 `evidence/directional/directional-motion.gif`，高阶三视图在 `../vfx-r2/evidence/high/`。已检查三视角的起始/接触/收势、完整环绕状态序列与镜头空隙。
- 另有 `evidence/contact/` 的 48 张左右拳双侧/正面近景时序图，结合世界坐标投影检查拳击方向；例如 `jab-v0-f3.png` 为左侧接近接触瞬间。完整世界 VFX 复验使用从 Sol 主场景取帧脚本复制的独立 harness，存档为 `user://star_abyss_vfx_r2_probe.json`，结束即清理，仅写自有 evidence 目录。
- 合入后仍须在独立测试档手测：低速步行与停止观察足底；G 起飞保持直立、Shift+W 全身前倾并连续左右转向，松开平滑恢复；连续左/右拳、上挑腿核对接触与扣血帧；右键格挡后受击；第一/第三人称对准同一目标按 R，确认目标可见且气刃沿准星方向、在实际命中时到达。最后回到两张用户截图的位置旋转相机，复现/排除黑三角。以上真实输入和完整世界验收尚未完成，不得沿用旧 52/52 宣称通过。
- 手测：W稳定到6.8m/s、Shift到10m/s，观察每0.5秒完整跨步周期与腾空回收腿；S后退看脚向反方向回收，A/D移动看方向；持续A/D加格挡不得旋转累积。新版前跑出拳应迅速减速并进入全身格斗架势，拳收回护头，接踢先提膝后伸腿；松开攻击后短时保持架势再回idle。boost出拳使用air_*独立动作。F6轮换R6/R8/R9确认开放效果可见。最终真实输入手感由总控完整试玩验收。
