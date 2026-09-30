# C2 动作与手部 R3 / 步态 R4

2026-09-27步态R4当前候选、步幅/接触规则、同镜头证据、SHA和复现步骤见[GAIT-R4.md](GAIT-R4.md)。本页下方R3验证是历史封版记录；当前资产只替换三条步态，26条战斗/飞行动作与网格绑定保持一致。

状态：本地 Blender 制作、Godot 导入与正常物理时钟视觉取证完成。使用既有已生成 `reference.png` 的走路、出拳、护势图派生，没有新增生图或付费3D。原C2源资产保留；当前 `c2-motion-r2.glb` 为51骨、29片段。

## 已落盘接口切片

`NativeMotionR2.cast_profile(realm, variant="")` 为静态方法；`variant` 可显式指定下表动作。`socket_transform_world(socket)` 纯读当帧骨姿势，返回世界Transform3D；无效骨点返回非有限origin。hand_l/hand_r直接读取palmL/palmR。掌面法线分别为左掌+basis.x、右掌-basis.x；basis.y由近掌根指向指根。拳的前指向使用basis.y，VFX释放方向仍由准星决定。

| 境界 | action | windup/release_time | recovery | duration | socket |
| --- | --- | --- | --- | --- | --- |
| R4 | cast_fist | 0.50s | 0.36s | 0.86s | hand_r |
| R5 | cast_palm | 0.42s | 0.40s | 0.82s | hand_l |
| R6/R7 | cast_sweep | 0.65s | 0.48s | 1.13s | hand_r |
| R8 | cast_cleave | 1.80s | 0.62s | 2.42s | hand_r |
| R9 | cast_skyfall | 2.20s | 0.72s | 2.92s | hand_r |

五种新片段的release_normalized统一0.50；Player以`_cast_action/_cast_windup/_cast_duration/_cast_release_normalized`传入权威动作时间。原左拳/右拳/踢腿继续使用0.38接触点。适配器不写玩家输入、伤害或存档。`palm/sweep/cleave`别名对应同类片段。所有新片段均有常规和air_版本，地面保留髋部蓄势与支撑脚，空中独立收腿。旧GLB缺动作的兼容分支仍保留，但最终探针证明不再走该分支。Player负责地面施法制动至0.25m/s。

保留Ctrl 1.6m/s慢走与6.8/10m/s跑速。当前R4完整周期步幅为1.4/4.0/4.6m、支撑相位.55/.20/.18，右脚错开半周期，phase按实际水平速度/步幅推进。R3历史1.2/3.0/4.0m与.52/.25/.21参数已被替换；R4步态单独锁定鞋跟/尖接触点，允许踝关节滚动，地面过渡仍0.15s。

## 本地资产制作

`hands_r3.py`只移除原模型袖口以下2534个融合手指顶点；原19身体骨rest逐矩阵断言保持一致。新增双掌+每手5指×3节，共32骨。每手1228顶点/1132面，椭圆掌面、分指关节环、拇指独立对掌链、背部关节护片及嵌入式皮革微纹理均在Blender构建并蒙皮；没有用刚性拳头道具替代手。握拳卷曲三节，掌法伸指，受击略松手。`hand-r3-build.json`记录局部改造范围，`source/c2-motion-r2.blend`为可编辑源。

`combat.py`把R4右拳、R5左掌、R6/7横扫、R8举臂下劈、R9双臂蓄势后下压分为不同全身关键姿势；短时间加速经过释放姿势，恢复回护势。jab前脚在.06–.33抬起并前送.16m、.34重新接地、.38接触，配合Player真实.18m胶囊踏步。胸腰额外16°前倾与.055m髋前送是可见身体动作，不改骨长或手套碰撞半径；新版2.3m起手真实触及，落空对照改为2.6m。

## 可核验创作研究

- [Mariel Cartwright（Skullgirls 主动画师），GDC 2014：Fluid and Powerful Animation within Frame Restrictions](https://media.gdcvault.com/GDC2014/Presentations/Cartwright_Muriel_Animation_Bootcamp_Fluid.pdf)。讲义第5–9、19–24、26页强调可辨识剪影、即使短动作仍有预备、主姿势附近的时间安排、贯穿和恢复，以及与游戏时间约束一起设计。这里采用“蓄力重心→髋/胸旋转→手掌/拳释放→回到架势”，不照搬角色或招式。
- [Arc System Works 技术美术 Junya Christopher Motomura，GDC 2015：GuiltyGearXrd's Art Style](https://gdcvault.com/play/1022031/GuiltyGearXrd-s-Art-Style-The)。已核验官方讲座摘要关于把2D格斗表现重建到3D；没有把未观看的视频细节当成事实。本项目推导：关键姿势必须在实际第三人称视角可读，模型保留C2身份。
- [Animation Mentor：Tutorial: Animating a Basic Human Walk Cycle](https://www.animationmentor.com/blog/tutorial-animating-human-walk-cycle/)。创作者教学摘要说明支撑/经过姿势中的重心转移，以及原地循环与前进距离匹配。用于定义接触、压低、经过、推离循环；速度、步幅、周期均由本项目实测决定。
- [Bandai Namco Studios：CEDEC2024《铁拳8》动画技术](https://www.bandainamcostudios.com/publications/%E3%80%90cedec2024%E3%80%91%E3%80%8E%E9%89%84%E6%8B%B38%E3%80%8F%E3%82%A2%E3%83%8B%E3%83%A1%E3%83%BC%E3%82%B7%E3%83%A7%E3%83%B3%E6%8A%80%E8%A1%93-%EF%BD%9E%E9%89%84%E6%8B%B37%E3%81%8B%E3%82%89)。已核验工作室发布的系统演进/性能讲座条目，仅作为进一步研究入口，不声称其支持某个具体动作数值。

## 诊断

原C2全身只有19骨，手套权重终止于wristL/wristR。拳击摆腕不能把半张开手套变为握拳。原walk参考0.88m/s/0.88m周期，jog6.8m/s/3.4m周期，sprint10m/s/5m周期；跑步回收脚最高0.43/0.53m且脚掌始终平放。原cast只有一套右手前推，所有境界统一映射0.38释放点。

## 文件与协作边界

此目录与 `../../scripts/native_motion_r2.gd` 由人物动作会话修改；经集成会话授权，另更新 `../../docs/PLAYER.md` 的动作说明段。player归飞行会话，main/ascension与 `../../docs/r3-combat-contract.md` 归武技集成会话。世界、袖口以上角色服装、原C2源GLB、存档、车辆保持原状。

## 具体试玩步骤

1. Ctrl+W慢走、W跑动、Shift+W冲刺，正常速度观察接地、脚跟回收、手臂反相摆动及停止/转向。
2. 左键连击观察两手由护势握拳、出拳、回收；R4–R9施法分别观察拳、掌、横扫、下劈、空中下压。
3. 用真实physics_frame采集实际delta、角色实际位移、当帧手部骨点和释放时刻；静态seek只作为姿势诊断，不代替正常速度动画或键鼠手感。
4. 独立验收会话检查真实主场景和正常输入。未完成时不得写成已通过。

## 本切片实际验证

- `inspect_hands_r3.py`只读原C2，在Blender 5.2.1工作台渲染原手套四视图：`evidence/r3-diagnostic/{front,outside,inside,back}.png`。可见四指融合成一团，确认需要局部拓扑重建；没有写原GLB或新模型。
- Blender 5.2.1逐帧检查29个片段的所有蒙皮顶点，有限性/模型跨度/边长筛查通过，最长边约0.305m；这只排除爆炸式拉伸，不替代美术判断。报告 `deformation-report.json`。
- Godot 4.6.2真实`_physics_process(delta)`执行`r3_live_probe.gd --capture`，1537帧、25.6167模拟秒、26.7663墙钟秒、time_scale=1；实际回调delta min/max/mean均约0.0166667s。51骨rest稳定、手脚骨点有限，五类地空动作的观察计时分别跨越释放时间一次，全部新片段存在，failures=[]、pending=[]。脚本采用合成状态驱动角色模型并按实际delta移动模型根，不模拟键鼠手感，也不声称验证Main伤害。
- `r3_key_preview.gd`在Godot原生OpenGL渲染132张正面/侧面/手部近景；静态seek仅验证轮廓、握拳、张掌与关键姿势。`evidence/r3-live/normal-speed.gif`、7个sheet及逐帧report来自正常物理时钟，不使用手动固定步长；GIF使用实际采样时间间隔并以累计10ms误差补偿编码。
- 平地夹具的相邻支撑帧踝点漂移约1e-7m；这不证明脚掌旋转、坡面或真人急转时绝无滑动。完整世界的坡面/转向与输入手感交由独立会话验证。正常时序sheet已检查走跑脚摆、横扫跨身、举臂蓄势与下压回收。
- 当前最终SHA256：GLB `e0f5cb5d91a87b99907f9f0678de6079d984898c9a886080c0ec1ab6aa84f8e9`；驱动 `02f549b4cc919b6bde4338ed04306e22c62873da09a9304e2990e9901df92398`。源码hash见`evidence/r3-final-hashes.json`。
- 正常速度GIF读回为201帧、25.580秒，与实际采样跨度加末帧保持时间匹配；`gif-timing.json`记录编码验证。
- 独立同批结果见 `../../reports/r3-independent/melee-final-audit.json`、`visual-final-summary.json`：2.0m与2.3m实际接触、2.6m落空及实墙阻挡通过；2140个真实物理帧测得稳态速度约1.5995/6.79994/9.99939m/s，支撑脚踝平面速度在报告舍入精度内为0。独立观察与本模块合成夹具的结论分别保留，均不替代真人键鼠手感。
- 独立封版入口：[FINAL-REPORT.md](../../reports/r3-independent/FINAL-REPORT.md) 与 [FINAL-MANIFEST.json](../../reports/r3-independent/FINAL-MANIFEST.json)。最终完整长链2090真实自动物理帧29/29；其后Main/Ascension/VFX的命中/空招小改另300帧10/10，不冒称所有证据同一全仓SHA。三距离与2140帧人物数据均对应本页最终人物GLB/驱动。报告仍保留一次未归因停高异常，以及真人键鼠手感、独立视频、精细手指艺术质量、完整鞋底旋转/坡面接触等未测边界。

在指定C: worktree根目录复现：

```cmd
D:\blender\blender.exe -b -t 2 --python godot/assets/motion-r2/inspect_hands_r3.py
D:\blender\blender.exe -b -t 2 --python godot/assets/motion-r2/build.py
D:\blender\blender.exe -b -t 2 --python godot/assets/motion-r2/verify.py
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --editor --import --quit
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --script res://assets/motion-r2/r3_live_probe.gd
node godot/assets/motion-r2/summarize_r3.cjs
C:\Users\HUAWEI\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe godot/assets/motion-r2/capture.py res://assets/motion-r2/r3_key_preview.gd
C:\Users\HUAWEI\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe godot/assets/motion-r2/capture.py res://assets/motion-r2/r3_live_probe.gd --capture
C:\Users\HUAWEI\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe godot/assets/motion-r2/r3_sheets.py
```

人工检查：Ctrl+W进入1.6m/s精细移动，W/Shift+W为6.8/10m/s；突然停下、反向、侧移观察支撑脚和头身转向。地面与G起飞后依次F6切换R4–R9，按R观察对应拳/掌/横扫/下劈/下压与真实手部蓄势源。近兽左键三连，2.0/2.3m应以真实接触结算、2.6m留有空隙则落空；贴墙出拳不能穿墙。最终真人键鼠手感不由本夹具宣布通过。
