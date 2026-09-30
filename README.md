# 星渊迷航 (Star Abyss Voyage)

Godot 4.6 原生迁移试玩工程现位于 [godot/README.md](godot/README.md)。Windows 可双击 [启动Godot试玩.cmd](启动Godot试玩.cmd) 直接试玩，也可导入 `godot/project.godot`。这是六公里盆地、角色飞行／空战和部分调查的可玩切片；浏览器完整版、旧 `src/` 工程及其存档继续保留。

> 2026-09-09：当前补丁 `C2-IDLE-FIX-20260909` 修正原地待机腿抖。C2 高精度美术替换尚未完成，用户已否决当前近似模型；差异、资产缺口与验收要求见 [C2 重新验收](docs/C2_REFERENCE_ACCEPTANCE.md)。下方 20260908 数据保留为历史切片，不能视为美术达标。

> **三维探索 × 坠毁舰调查 × 时序谜团** —— 切换第一/第三人称，走进远方的真实残骸，寻找那段使用自己声纹的求救信号。

## 开发文档入口

2026-09-30 review 修复：新克隆先运行 `npm ci`，再运行 `npm test`。默认测试递归覆盖 `playable/tests`、`playable/src` 和 `tools` 下的 `.test.js/.test.mjs/.test.cjs`；`npm run test:legacy` 仅保留旧 JS 子集。CPU 通过不代表自然成长、画面或性能验收完成。范围、交接报告和复测步骤见 [review 修复记录](docs/development/REVIEW-REPAIR-20260930.md)。

2026-09-12：重做趴下、爬行和第一/第三人称趴姿镜头，修复下车后需按 Alt 才能恢复鼠标转向。对应 Blender/GLB 与复测步骤见 [趴卧重构](docs/PRONE_REDESIGN.md)。

按玩法测试：`npm run test:feature -- --list`；例如 `npm run test:feature -- dash`。完整发布回归：`npm run test:release`。独立测试、失败报告与发布条件见 [玩法测试指南](docs/GAMEPLAY_TESTING.md)。

长期开发以 [科技修真 D3 模块总览](docs/cultivation/README.md) 为入口：角色十境界、战斗/十大武器、三十丹方、二十六固定 NPC、怪物/33种灵宠、星球区域和分阶段实施。配套 [3D／特效／工程规范](docs/3D_VFX_ENGINEERING_SPEC.md)。D3 覆盖旧 D2 的对应玩法范围；这些是后续开发目标，不代表功能已经实现。

野怪、材料再生与随机事件由规划中的 [世界刷新系统](docs/cultivation/08_WORLD_DIRECTOR.md) 统一管理；采用本仓库独立模块与开发调试入口，不另建第二项目，配置与接入顺序见 [开发面板规格](docs/cultivation/09_WORLD_DIRECTOR_CONFIG_AND_TOOLS.md)。

最新补充：[储物与负重](docs/cultivation/10_STORAGE_AND_ENCUMBRANCE.md)、[随机洞府](docs/cultivation/11_CAVES_AND_FORTUNES.md)、[丹药与后遗症](docs/cultivation/12_MEDICINES_AND_AFTEREFFECTS.md)、[分境速度与追逐](docs/cultivation/13_MOVEMENT_AND_PURSUIT.md)、[单机/联网边界](docs/cultivation/14_OFFLINE_AND_ONLINE_BOUNDARY.md)。均为拟实现设计，现有游戏行为以验收台账为准。

宠物设计：[成长收服](docs/cultivation/15_PET_PROGRESSION_AND_BOND.md)、[神兽33种图鉴](docs/cultivation/16_PET_BESTIARY_33.md)、[骑乘空战与资产维护](docs/cultivation/17_PET_3D_FLIGHT_AND_ASSETS.md)、[起名装扮与多人身份](docs/cultivation/18_NAMES_PET_STYLE_AND_IDENTITY.md)。

当前可玩规则见 [HTML5 原型说明](docs/HTML5_PROTOTYPE.md)，实际验证结果见 [验收台账](docs/HTML5_VERIFICATION.md)。[早期 GDD](docs/GAME_DESIGN_DOC.md) 与旧进化方案保留用于追溯，不作为当前浏览器版实施依据。

---

## 核心概念

当前版本 **C2-ASSET-PERF-20260908**：按 C2 参考方向替换大 V 领肩胸甲、象牙石纹矿壳与灰褐织物材质，强化肘膝褶皱，修正小腿穿插和后脑过大的黑色部件；同时优化模型、岩石绘制与渲染开销。保留独立身体方向、鼠标环视与四向步行，以及按身体方向执行的 R 入门矢量闪避；[闪避玩法与测试步骤](docs/DASH_ENTRY_IMPLEMENTATION.md)。这些是程序化资产改良，不声称 1:1 高精度还原参考图；完整五境界与战斗路线尚未实现。

当前 HTML 可玩版为《静默回声》：求救信号比你的登陆早了 17 分钟，声音却属于你。6 × 6 公里的三维地表连接可步行进入的 320 米坠毁舰。

- **真实空间** —— 鼠标转向与 Alt 独立环视、实体岩石与船体碰撞、连续室内通路及避障第三人称
- **落脚反馈** —— 19 骨骼全身蒙皮与授权动作片段，贴地修正和材质足音同步；尘土、碎砾、岩面、金属分别反馈
- **探索导航** —— 地图标点、已知地点追踪、舰内测绘与方向距离指引
- **分层赶路** —— 玄壳共生服短时低空越障；寻找部件修复勘探悬浮车，停放位置和电池与地图、存档相连
- **双线成长** —— 真实徒步与调查成果解锁身体进化，供电与异常研究解锁装备校准；冲刺与助推时长分别成长，不靠反复耗空资源刷级
- **证据驱动** —— 恢复供电、对照记录、操作实体中继并解开密封舱
- **神秘感** —— 矛盾的时间戳、空乘员名单、提前出现的声纹
- **后续调查** —— 黑匣子带回后手动调谐两处异常的三路相位，定位地下回声源并反相隔离，再返回离线封存
- **远野证据** —— 两章完成后探索三处实体测量装置；每次现场采样、返回封存，才逐步展开下一条索引

---

## 游戏循环

```
追踪回波 → 进入残骸 → 供电与中继谜题 → 回收黑匣子 → 返回隔离
        → 石碑 / 逃生舱现场校准 → 地下回声源 → 返回封存
        → 断环观测架 → 返回封存 → 埋沙镜阵 → 返回封存 → 倾斜石柱 → 远野终记
```

按 **U** 打开「共生进化」查看条件并逐级确认。满体力冲刺与满能量助推均为 **30 → 60 → 90 → 120 秒**，初始 30 秒、每级增加 30 秒；身体需要真实地面徒步、对应调查里程碑和站稳休息，装备需要带回研究成果并靠近校准工作点。升级不会补满体力或能量，也不提高 4.5 米限高；耗尽后的松键、恢复及重新按键限制保持不变。旧成长存档保留已确认等级及当前资源百分比，无需重开。具体条件见 [成长规则](docs/HTML5_PROTOTYPE.md#身体与装备的双线进化)。

地图保持 **6 × 6 km**：按当前 6.3m/s 调校，满级单次疾跑理论约 0.76 km、助推约 1.44 km，现有空间足够承载新续航。本轮不扩大尚未填满调查内容的外围空地。

### 本轮试玩

2026-09-12 键鼠与第一人称：**WASD + 鼠标** 移动转向，**W+Shift** 疾跑，**Ctrl** 慢走，**C/Z** 蹲伏/趴下；**Space 轻按跳跃、长按升空**（G 保留助推），**Q 扫描、E 闪避**，**Alt** 独立环视并松开回正，**=** 自动前进，**F** 交互，**M** 地图。第一人称默认空手，扫描时才取出设备并自动收回。见 [桌面控制说明](docs/PUBG_STYLE_CONTROLS.md) 和 [设计图、Blender 资产与复测](docs/FIRST_PERSON_EQUIPMENT.md)。

当前元婴自身飞行：**G 起飞/上升，空中 Space 上升、按住 C 下降、松开悬停**。地面 C 仍为蹲伏，Ctrl 仍为慢走。F2 高度跳转后需点“恢复键盘飞行”再使用 C；见 [R4 飞行按键说明](docs/development/FLIGHT-CONTROLS-R4.md)。

当前实际游戏前 / 侧 / 后常速为 **4.7 / 3.2 / 2.8 m/s**，站立疾跑 **6.3 m/s**，Ctrl 慢走 **1.65 / 1.3 / 1.2 m/s**；蹲伏和趴下分别按 0.52 / 0.18 系数降速。起步、反向和刹停有短暂速度过渡。驾驶为 W/S 油门、A/D 转向、鼠标环视、Space 刹车、停稳 F 下车；**V 可切驾驶第一人称/追尾**，下车恢复步行视角。新增同车双握把、真实车速/电量仪表和手部模型，见 [设计图、3D 与验证](docs/VEHICLE_FIRST_PERSON.md)。姿势与身体/观察方向分别存档；按住的输入及自动前进不会恢复。

打开 [C2 实际 3D 验收页](docs/ui-implementation/c2-character-preview.html)，可切 6 种动作、播放 / 单步与八角度；`npm run preview:avatar` 重建。对照 [造型概念图](docs/ui-concepts/c2-independent-20260908/turnaround.png) 和 [动作概念图](docs/ui-concepts/c2-independent-20260908/keyposes.png) 检查肩腰比例、矿壳连接、膝肘、鞋底及正背侧轮廓。当前是程序化矿壳 / 织物模型，不是概念图级扫描资产；后退 / 侧移是对 [Quaternius CC0 全身前进片段](playable/assets/animations/CREDITS.md) 的解析重定向，不是新采集的独立动捕。

最终代码全量规则 **253/253** 通过；`npm run test:feature -- movement` 单次门禁规则 **119/119**、浏览器 **14/14** 通过（690 秒），状态 `FEATURE_PASSED_NOT_RELEASE`，前后被测文件指纹一致。119 项是全量规则的子集，不额外相加。此前 246 项及分批结果仅作历史。自动化不能替代全角度画面、手感、性能、全流程与正式托管环境验收，不等同可上线。

模型预算从约 71,500 降至 **45,000 三角形以下**；四张 512 纹理含独立凹凸图，总纹理预算 5.33 MiB。岩石最终采用 **768 m** 分块视锥剔除，不按距离删除、碰撞保留：256 m 方案带来 238 次绘制，768 m 为 161 次，基线 138 次。动态渲染比例 0.65 至 min(DPR,1.25)，有热身和迟滞，仅改变 3D 画布，不降低 UI 或模拟精度。同条件 1440×900 无头采样，最终 tuned 的 p50 / p95 为 **383.3 / 483.3 ms**，基线为 **416.7 / 433.4 ms**；P95 反而变差，结果波动，不能证明实机流畅或稳定 60 FPS。此前 after 的 299.9 / 366.7 ms 是未接入岩石分块的中间版，不作为最终改善证据；原始采样未记录真实 GL 驱动，不能断言软件或硬件渲染。追加 [verified 驱动采样](docs/ui-implementation/locomotion-profile-verified.json) 确認本次无头环境为 ANGLE Vulkan SwiftShader 软件渲染：p50 / p95 / max 为 349.9 / 433.3 / 450 ms，比例 0.65，161 次绘制、379,840 三角形。该结论只适用于本次测试，不能追溯认定基线同驱动，或归因用户设备问题、承诺实机改善比例。保留记录：[基线](docs/ui-implementation/locomotion-profile-before.json)、[中间版](docs/ui-implementation/locomotion-profile-after.json)、[最终分块采样](docs/ui-implementation/locomotion-profile-tuned.json)。

分别在尘地、碎石、岩面和舰内金属甲板听脚步；起飞 / 驾驶时不应有步声，着陆只响一次。Tab / Esc 暂停时尾音快速停止，恢复不补播旧声音。当前为动画师制作的骨架动作＋有限贴地修正，声音仍是本地合成；不是动捕或完整物理仿真，自然程度仍需试玩确认。

### 调查流程复验

刷新 `playable/star-abyss.html` 后选择「继续调查」，无需重开。已有两章完整存档直接接续断环观测架；尚未完成的存档按原进度继续，已完成的校准与进化等级不重置。

1. 第二章在石碑或逃生舱旁落地、下车，面向终端按 **E**。调节三路滑块或 **±15°** 按钮，让「实测相位＋补偿」归零；裂隙终端的目标是 **180° 反相**。三路全部锁定后点击确认，才保存结果。
2. 可先随便调一路，再按 **Esc / Tab** 取消，确认返回后直接控制方向；取消不推进，未提交的旋钮位置不写入存档。终端打开时移动与资源计时暂停。
3. 两章离线封存后，按任务或 Tab 地图追踪第一处远野装置。现场调谐取得样本，再回返回信标按 **E** 封存；每次封存解锁下一处。勘探车与升级后的低空助推均可用于赶路。
4. 在「已有样本、尚未返回」时刷新继续，核对样本仍在；三处封存后查看档案中的独立远野终记。重复调查、重复封存不重复计数。

C「玄壳共生服」保留修长人体、灰褐织物、薄片式非对称矿壳与 S 形琥珀脊线；当前仍是程序化三维模型，不等同于高精度概念图的建模与材质质量。

---

## 开发路线图

当前 HTML 仍是有限区域调查纵切。多星球与飞船航行、完整制造及交通工具生产、高精度服装和场景美术尚未开发；更丰富的环境事件与更多调查内容也仍待补充。这些不是现有可玩功能，本轮不放置空壳入口或伪造材料奖励。

HTML 当前方向以 [静默回声规格](docs/HTML5_PROTOTYPE.md) 为准。以下阶段记录属于早期 Godot 生存塔防路线；`src/` 尚未同步新设计，本次没有修改其既有工作。

- [x] **Phase 0：概念设计** — Game Design Document 完成
- [x] **Phase 1：原型验证** — 已具备 O₂、采集、建造、昼夜防守与撤离闭环
- [ ] **Phase 2：垂直切片** — Crash Zone 完整内容
- [ ] **Phase 3：内容生产** — 全部区域 + 完整科技树
- [ ] **Phase 4：打磨发布** — 优化、测试、发行

---

## 技术栈

| 项目 | 当前选择 |
|------|----------|
| 引擎 | Godot 4.6.2 |
| 代码 | GDScript |
| 游戏工程 | `src/` |
| 浏览器规格原型 | `playable/star-abyss.html`（双击离线运行） |
| HTML 渲染 / 构建 | Three.js 0.180.0 / esbuild；`npm run build` |

---

## 文档

- [早期 Godot 玩法执行版](docs/GAMEPLAY_v3.md)
- [HTML5 可玩规格原型](docs/HTML5_PROTOTYPE.md)
- [HTML ↔ Godot 行为契约](docs/HTML_GODOT_CONTRACT.md)
- [完整 Game Design Document](docs/GAME_DESIGN_DOC.md)
- [代码审查记录](docs/REVIEW.md)
- [HTML5 原型验收台账](docs/HTML5_VERIFICATION.md)
- [手工测试计划](docs/TEST_PLAN.md)
- [开发规则](docs/AI_DEVELOPMENT_RULES.md)
- [历史进度](PROGRESS.md)

---

> 🎮 *"在深渊中呼吸，在星光下逃离。"*
