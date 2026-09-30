# 原生武技 R4 · 实施与验收记录

2026-09-29。工作目录为 C 盘 `3ff0` worktree。此文件仅记录本轮武技，不代表全游戏完成。

## 图像与资产来源

使用内置 imagegen，首批批准上限四张，目前两张。提示词与原图保存于 `assets/martial-r4/prompt.txt`、`reference.png` 和 `impact-prompt.txt`、`impact-reference.png`。第一张 A/B/C 分别对应近身崩拳、定向风刃、蓄力破岩及取消，地空支撑分别烘焙；第二张对应主动坠地、接触缓冲、恢复和远距瞬移，生成检查完成后才制作其动作。

第一张内部检查：双足支撑与髋肩先后顺序明确，拳接触与落空分开；风刃从手的斜扫轨迹出生；破岩双掌压缩后推进，取消时不产生地面爆裂。第二张检查：下坠与普通下降区别明确，深蹲/拳触地后才扩散；空中取消无坑；瞬移无贯穿星球的光束。概念图中的树岩碎裂由生态资产负责，武技特效不得冒充实际破坏。

`build.py` 只读取现有 C2 GLB，把原骨骼 rest 保留为独立动画库；不改现有网格、共享 GLB 和走跑片段。拳、风刃、破岩、取消、下坠、落地、瞬移、到达均有地空版本，共16段、51个原关节、每段153条变换轨道。`build_vfx.py` 建立六种有收尖/纹理坐标的曲面资源（含返地裂隙），无物理碰撞、无运行时球盒占位物。

## 基础切片

|动作|依据与门槛|输入/消耗/CD|真实判定|
|---|---|---|---|
|崩拳|D3-20 WS17，R0|R；5%归一灵息；5秒|当前拳面短段，1.8米仅最大范围，不能凭空伸长手臂|
|风刃|D3-20 ES11，R1|R；6%；6秒|22米上限、32米/秒有限弹道，每物理帧扫掠，墙和树岩截停|
|蓄力破岩|D3-02基础重击，R0；不是已完成的锤类WS10|按住R，0.35秒前松开取消，最多1.1秒蓄势；9%；9秒|双掌起源、2.5米短压力前锋，蓄力与境界决定环境冲击力，未命中不造坑|

T 在已达境界的动作间切换，冷却按动作保存，切换/重开不刷新。默认保留普通左键三连。该原生试玩尚未迁入正式学习、传承和熟练度闭环，不冒称60式已全部开放。伤害暂取D3-19一级基础攻击与表系数，整体境界敌人数值仍需另做平衡验收。

R按下进入动作才扣耗，基础武技开始后取消/受击不返还已耗能，与旧R3约定一致。右键按下显式取消，不能依赖 `guarding`（Player在施法时会禁止guard状态）。动作结束返回Player当前地空状态。已经释放的弹道继续存在；起手中断不留下延迟伤害。

## 协作接口

权威模块 `native_martial_skills.gd`；Main仅转发输入、提示和附加存档。动作库通过 `native_martial_library.gd.install(motion)` 接入现有AnimationPlayer，骨轨道重定向至原C2骨架。

环境仅调用组 `native_environment_damage` 的 `damage(query)`：`origin/radius/direction/reach/power/damage_type/source="player"/cast_id/phase`。`cast_id`每次唯一，`phase`默认0；生态按cast/phase/entity去重。碰撞截断在调用前处理，VFX从不触发伤害。树岩生命周期及落地碰撞由生态所有。

高阶主动坠地等待Player真实触地事件；同一个事件向生态伤害及地形变形提交，地形owner未确认碰撞重建前不得宣称真坑完成。远距地表瞬移需要合法干燥落点、真实碰撞ready以及有限境界距离。

## 验收步骤与当前状态

已完成：两张图的内部结构检查、Blender CPU导出、Godot导入、实际C2实例16段/51骨安装检查；独立隐藏窗口正常物理帧基础检查16项通过。实际主场景通过近身拳命中/5米落空、一次释放、R0风刃锁定、8米有限弹道命中、前景墙截停、提前松键/右键取消、满蓄力命中、冷却与环境同档、写档失败保留镜像、有效内嵌状态修复坏侧档、无效内嵌状态保护等检查。

基础版本证据位于 `reports/martial-r4/basic-verification.json`、`capture.log`、`dependency-hashes.json` 及157张默认相机截图；该次测试前后14个核心脚本哈希一致。夹具使用实际敌人网格但冻结其运动，只证明技能几何与输入流程，不代表移动AI验收。独立审查未批准整体动作画面：近距兽体遮挡拳接触，默认背视角破岩聚气难辨、白色命中环过大。`independent-review-contact-sheet.png` 保留原证据。

2026-09-30 后续修订：按原C行参考加强破岩下沉和肘展开，聚气增加内收细流，缩小命中环并使用独立青色材质；不改默认相机、共享骨架或走跑。碰墙初始overlap先挡住敌人判定，非零目标视线同时检查地形和生态层。坏主档恢复后的首次提交保留已验证 `.bak`，恢复副本复制失败也会保护原档。旧16项报告属于先前哈希版本，上述受影响项仍需复验。

2026-09-30短headless独占窗口通过：实际AnimationLibrary载入16段/51骨，7GLB导入缓存均与源MD5匹配；Godot优化后每段49轨（源153轨），已加载轨道路径及关键帧值指纹（不含关键帧时间和插值模式）在 `loaded-library-verification.json`。两份实际runtime脚本的check-only通过。返地小型fake契约53/53通过，仍不是实际碰撞证据。同一SceneTree内Main磁盘保存及场景重实例化自测107检查通过（含夹具打开/写入等辅助断言）：技能选择/CD、环境同次提交优先于旧镜像、坏主档恢复、首次恢复后备份SHA不变、双坏档字节保留、{} / null / []非法环境、坏地形记录、实际F5写失败提示。`save-recovery-verification.json` 与 `save-recovery-dependency-hashes.json` 记录14依赖均未变化；故意坏JSON夹具产生预期解析诊断，无脚本异常。测试停用了战斗/部分physics并直接import合法环境marker，只证明磁盘保存及场景重实例化，不证明操作系统进程重开或实际毁树恢复；后续用两次独立Godot进程补真实R毁树→磁盘→重建碰撞。此次仅修测试自身类型/Node.ready命名冲突与假World未ready时误发票据，生产未改。

待验：真实树岩毁坏与技能联动、空中三招、960像素中文HUD、高阶远距返地及主动触地后真实网格/碰撞凹坑。World票据与地形变形独立物理检查已通过，武技联动还需真实运行。

存档采用主JSON内嵌环境权威状态，侧档仅镜像；临时文件写完后替换主档并保留 `.bak`。坏主档可恢复有效备份并另存原始异常文件；主备均坏或内嵌环境状态不合法时禁止覆盖，不能当新游戏处理。高阶瞬移即时失败/准备提示也会显示在HUD。

已通过check-only但尚未runtime：`tests/native_martial_environment_runtime.gd` 使用真实Main/Player、R/G输入及正常物理帧，放置正式生态资产作为接触夹具，检查树岩破坏、薄墙初始重叠、空中三招、主动冲击和真实地形射线下凹；自然生境分布由生态验收另测。`tests/native_surface_blink_runtime_verify.gd` 检查真实Ctrl+Q、票据、有限高空距离及完整动作提交。存档测试已按上一段完成。共享GPU/导入窗口排队期间不得并行启动Godot。

主动坠地由 `surface_deformation_committed` 确认结果；仅请求时显示“地形正在重建”，实际网格/碰撞交换成功后才显示“冲击坑已形成”。显式坏 `surface_impacts` 字段会禁止覆档，只有旧档缺字段才迁移为空记录。

独立测试槽使用 `user://martial_r4_verify_*.json`，不得读写用户正式槽。实际测试依次：

1. 默认第三人称，R0崩拳贴身命中，后退3米落空；墙后目标无伤害。
2. R0不能风刃，R1切T选择；观察手部起源、有限飞行、前景墙截停及移动目标可躲。
3. 蓄力0.2秒松开、右键取消、受击取消均无迟发伤害；满蓄力击中树/岩，核对仅一次毁坏和真实碰撞变化。
4. 空中三招动作与地面支撑不同，结束返回正在使用的巡航/悬停姿态，未触地不生成地面冲击。
5. 施放后切招/保存/重开，冷却仍保留；两个独立槽的毁坏状态不串档。
6. 高阶主动落地冲击与远距瞬移另立真实输入/正常physics/落点与mesh-collision证据，不能由以上基础通过替代。

### 2026-09-30：r4.2同步窄修（运行验证待联合窗口）

- Main识别生态generation不兼容，保留人物/世界读取结果，常驻显示“环境未恢复 · 保存受保护”；自动保存、F5与关闭仍走同一save_blocked保护。ready、位置恢复提示不会掩盖原因。
- 坠岳交接按Motion实际采样normalized progress保持俯冲关键帧，不再从起手末尾约50%回到25%；触地/取消复用Motion已有的空中0.16秒/地面0.10秒骨骼pose过渡。仅改武技模块，不改Player、Motion、GLB或骨架rest。
- 待验证：真实R输入最后起手帧→首个descent帧→接触/取消，默认相机+辅助侧面；真实树岩破坏、实际地形碰撞坑、高空Ctrl+Q。
- 新增run_environment_generation_guard.py：独立Main合法存档仅改generation，由另一OS进程加载；等待自然12秒自动保存周期、F5、显式保存、关闭，外部父进程比较主档及备份/镜像字节。当前仅Python语法检查，尚未运行Godot。

联合测试脚本已补齐以下尚未执行的步骤：接受下砸后松R取消、自然等待冷却；按帧记录起手/俯冲/触地/取消的默认相机与辅助侧面、真实clip时间及骨骼pose。producer最后把真实树岩破坏和碰撞坑保存到独立交接槽；第二个OS进程通过Main正常读取，核对倒树重建、岩石破坏状态、非零下砸冷却以及真实terrain ray的坑深。默认用户档的只读hash仅作观察，外部游玩可能改变它，不用来宣称用户槽整体未变。

### r4.2首次真实联合结果（未通过）

`godot/reports/martial-r4/environment-runtime-r42-first-failed.json`保留26/37结果；本轮1060项源码/生态资源前后SHA相同。近拳/5m落空/8m风刃/薄墙初始重叠防穿、G升空后三种动作与恢复、接受下砸后取消和自然CD通过。真实树岩单体命中失败：Godot实体碰撞已发生，但生态有限胶囊查询被安全中心截在表面外，待首RID/unsafe接触诊断和最小修复。最终下砸未开始因取消动量与自然CD后AGL仅0.4m，低于4m门槛；测试已补再次真实G升25m，生产未因此改变。真实坑及本轮跨OS恢复尚未通过，未运行consumer；旧handoff从producer开头标记incomplete，只有本轮所有检查通过才complete。

下一短验步骤：两次真实R读出safe/unsafe/world RID/shape/几何gap；合法首碰修复后核对树后障碍仍挡；取消后记录真实velocity/clearance与G制动；用G重获合法高度后实际R下砸，成功后再执行最终保存与独立OS读档。

### 首接触修复与短下砸通过

- pine真实sphere cast的safe_gap=+0.743mm，unsafe_gap=-0.424mm。仅用同次fraction[1]的有限unsafe中心补闭接触；环境候选锁定权威首RID，safe仍用于敌人与视觉终点。
- 完整岩石的凸壳比chunk胶囊大；仅outcrop代理无候选时，用本次contact point/normal/shape进行有限段范围校验与±0.01m表面ray再确认同RID/shape，继续正常LOS。没有延长攻击距离或扩大伤害半径。
- 初始重叠采用同一rest的整组信息；不同碰撞体同时重叠则拒绝环境伤害。contact-convex-r42记录pine/rock同瞄点及前墙/后敌/单墙保护6通过，新增双重重叠夹具首版未成立；修正夹具且生产不变后contact-ambiguous-r42独立2/2通过。
- `descent-diagnostic.json`、`descent-short-r42-dependency-hashes.json`：真实G/R短下砸16/16，取消后G制动、自然CD、再次真实升空、时间不回跳、单次落地、树倒岩裂均通过；实际TerrainCollision ray深2.3533m，变形record深2.392m且恰1条，1060项依赖未变。该报告早于outcrop单体fallback，后者不改变AoE路径。
- 视觉仍未通过（independent-r42-*review.png）；下一步跨OS实际毁坏/碰撞坑恢复与高阶返地票据。

### 两OS进程验证与合成版本保护（限定范围）

`persistence-producer-r42`仅跑实际毁坏/下砸/保存路径，25/25，PID34596退出0后才启动consumer PID15828，14/14。测试重设realm/energy/位置，producer暂停AI，不能代表自然游玩端到端。真实R倒树后原standing碰撞停用、替代网格/碰撞重建有有限夹具证据；碎岩只核对state相等，未完整验证重注册后的碎块实际碰撞与落位。选择、非零descent CD及真实单坑记录恢复，坑collider射线在两个OS进程都为2.35333657m。碎块support修复后需补实际碰撞/落位复验。

`reports/environment-generation-guard/20260929T172358Z_2c5ddd325999/result.json`合成版本不兼容保护通过：合法r4.2 envelope仅改generation为r4.1并加marker，并非历史r4.1真实拓扑档，不证明历史迁移。两个进程保留进度且环境未恢复，等待自然自动周期、真实F5及显式保存；关闭由game.notification调用生产WM_CLOSE_REQUEST handler，未发送真实OS窗口消息。退出后外部父进程校验五份文件字节保留。

实际画面限制：`persistence-crater-default.png`可见大岩片悬于降低后的坑面上方，疑旧地面settle与随后变形的联动缺口，已交生态只读定位；上述物理坑/存档通过不表示残片落位与美术已验收。

### 高阶真实返地窗口完成

`reports/surface-blink-runtime/1535947/runtime-verification.json` 138/138，R9真实Ctrl+Q返地距离124999.203125m；R8同高度拒绝、取消/移动/前后障碍、一次消耗/CD与独立槽保存均通过。高空位置用canonical fixture布置，不计为G飞行距离。`surface-runtime-r42-dependency-hashes.json`1060项前后无变化。已结束引擎并释放GPU窗口；返地aperture细弱和其他动作美术未过，岩片悬于坑上方仍由生态只读定位。

岩片悬空证据范围补充：上述目标为正式生态资产的手注册测试夹具（parent在Main，record.cell=martial-impact-*），未进入NativePlanetEcology.cells/supports；原生invalidate_surface_region不覆盖它们。因此暂不能从这张图判定自然streamed生态有相同缺陷；生态owner正在用原生cell卸载/重建路径核查。

手动复测步骤：R6及以上按G升至离地4m以上，T切到坠岳冲击后按住R，松R取消并按G制动；R9高空朝地面保持瞄准后Ctrl+Q返地，移动或再按Ctrl+Q取消；F5后完整退出重开，检查破坏状态、坑碰撞与剩余冷却。使用独立测试槽执行自动脚本，保留旧generation不兼容档的保护提示。

### 高空返地数值口径核对（2026-09-30）

当前1535947/runtime-verification.json SHA256为fc9c0c44341dc77da28d44205e39773561cff4516c6b74c404dd31587b4c55df。r9-125km-arrival的before.agl=125002.097951898m，outcomes[0].result.distance=124999.203125m；即时outcome.state.agl与resolution.agl均为0.80001425743103m，after.agl=0m（自然落地）。起点AGL、位移距离和落地后AGL是同一case的不同字段，不能相互替代；旧报告与截图保持原文件，没有为核对数值重跑。

### 支持联动补测首轮与CPU动作候选（2026-09-30）

新测试使用独立support-r43报告与测试槽，生产damage=681d4ff64c310c975f8abe18f5021d92d5373cfe737f3b105a017f140bc778ee、ecology=73e2c462a670b31cf3d632834a00b65d0d05d9ebf9e664688fca2310f6b99db1。实际R producer首轮140/144，退出1；handoff.complete=false，未启动consumer。完整首轮文件及SHA封存reports/martial-support-r43/first-failed。全部6碎块真实enabled shapes、loaded terrain ray及normal settle通过，最低间隙约-0.000042至+0.001640m；两个固定stump在坑后最低离地+1.047597/+0.927302m，证明夹具路径根基悬空。坑前stump最低-.228255m属于设计埋底，其abs≈0断言需分锚定与自由碎块；chunk4的30首碰先遇其它碎片/terrain，需新增自身有限物理shape查询证明，不能据射线遮挡直接断言碰撞失效，也不能仅过滤障碍求通过。自然生态另由owner测试。当前版本不是已跨OS恢复认证。

视觉候选在assets/martial-r4-candidate-01，整个目录.gdignore隔离，复用原两张具体分解图，无新生成费用。CPU候选10段break/cancel/descent/descent_cancel/landing；采样修正过高双掌、IK冲拳不可达、落地膝贴地及左臂高举，保留每SHA独立审查。当前生产资源与Motion未替换；专属descent_cancel只匹配已接受俯冲，早取消须另按phase保持当前pose回飞行。CPU静态图不计正常速度默认相机验收；下一独占窗口优先真实R两动作与默认背视聚气/实际接触/取消恢复，再逐招风刃和aperture。
