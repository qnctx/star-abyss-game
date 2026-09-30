# Scenario skills 对星渊的参考价值

研究日期：2026-09-30（Asia/Shanghai）。只读研究；未安装技能/插件、运行仓库脚本、连接 Scenario 账户、上传资产、使用凭据、调用生成或付费分析。没有启动 Blender/Godot 或占用 GPU。

## 结论

最值得借鉴的是**固定参考的资产变体、材质分族、逐项审核、批次预算和来源追踪**。这些流程能减少树岩重复和参考漂移，但不能保证生成模型还原原图。它也确实提供网格、绑定及动作相关路线，不能简单说“只有生图”；另一方面，没有现成 Godot 接入，不能替星渊完成真实碰撞、地形破坏、敌人决策或流送优化。

建议先做本地审核清单，再选一个材质小样，最后才考虑单个环境资产的完整图→3D→Godot试制。以下均是未来方案，本轮未执行，也不构成任何新生成预算。

## 核查范围与版本

- 原仓库：[scenario-labs/skills](https://github.com/scenario-labs/skills)，冻结到 [5786accd3bb6d79808330230c698898862e8a1d4](https://github.com/scenario-labs/skills/tree/5786accd3bb6d79808330230c698898862e8a1d4)，提交时间 2026-09-28 14:20:46 UTC。通过公开 GitHub commit API 确认 SHA，下载该 SHA 源码归档后仅作为文本读取。研究副本在项目外 `C:/Users/HUAWEI/.codex/scenario-skills-review-source`。
- 实际工作树 `C:/Users/HUAWEI/.codex/worktrees/3ff0/star-abyss-game`；已读 `AGENTS.md`、`docs/C2_REFERENCE_ACCEPTANCE.md`、`docs/3D_VFX_ENGINEERING_SPEC.md`、`godot/README.md`、`godot/docs/PLANET-NATIVE-CONTRACT.md`、`ECOLOGY-R3-INDEPENDENT.md`、`NATIVE-AI.md` 和定向 PROGRESS 条目。没有重复全项目代码审计。
- 项目基线是 Godot 4.6.2、半径 120000m 星球、保留旧六公里盆地。已有 C2 接入历史明确记录“数值通过但原图差距仍大”；新动作/武技/VFX必须先生成具体分解图、审核后制作，并在 Godot 正常速度验证最终蒙皮。
- 官方资料证明“文档列出能力”，不等于本账户已获权限，也不等于本项目已实测。远程能力均未认证调用；本地脚本均未运行。仓库作者的测试声明与本轮独立验证分开记录。

## 仓库是什么：三种不同层次

| 层次 | 实际内容和证据 | 对项目的含义 |
|---|---|---|
| 技能/工作流文档 | [README](https://github.com/scenario-labs/skills/blob/5786accd3bb6d79808330230c698898862e8a1d4/README.md)、[核心技能](https://github.com/scenario-labs/skills/blob/5786accd3bb6d79808330230c698898862e8a1d4/skills/scenario/SKILL.md#L15-L50)：发现模型→读schema→报价→运行→等待→展示/下载 | Markdown指导代理操作；不是一份下载即能运行的生成服务。核心技能 L17 描述默认工具及catalog执行通道。 |
| 真正的远程服务接口 | [官方统一生成 API](https://docs.scenario.com/api/resources/generate/methods/run_model)、[3D生成说明](https://docs.scenario.com/get-started/generation/3d-model-generation)、[工作流 SDK](https://docs.scenario.com/sdk-helpers/workflows) | `POST /generate/custom/{modelId}`返回异步任务；workflow是远端节点图。MCP工具来自外部Scenario服务，不由此仓库自行实现。需要账户、权限、模型和预算。 |
| 本地 DCC/引擎代码 | [Blender说明](https://github.com/scenario-labs/skills/blob/5786accd3bb6d79808330230c698898862e8a1d4/skills/dcc/blender/README.md#L5-L28)、[bx_anim.py](https://github.com/scenario-labs/skills/blob/5786accd3bb6d79808330230c698898862e8a1d4/skills/dcc/blender/scenario-blender-animation/scripts/bx_anim.py#L61-L83)、[bx_audit.py](https://github.com/scenario-labs/skills/blob/5786accd3bb6d79808330230c698898862e8a1d4/skills/dcc/blender/scenario-blender-expert/scripts/bx_audit.py#L49-L95) | 有真实`bpy/bmesh`代码、action slot/channelbag处理和网格检查，并非全是提示词。需要本地软件及适配，不能把教程套路当成项目成品。 |

README列出65个Scenario技能，另有Blender、Maya、ZBrush、Unity、Unreal专家家族。查阅`skills/game-engines`目录只有Unity和Unreal家族；“可导入Godot”是格式/流程提及，**没有Godot专家家族或星渊适配器**。

## 可直接借鉴：无需接入服务就能采用的方法

| 星渊问题 | 有价值的方法 | 证据、限制 |
|---|---|---|
| 树岩变体既重复又容易变成另一种风格 | 固定一份批准参考和完整基线，每次只改分枝方向、损伤程度、石层走势等一个delta；每个变体都回到同一参考，不串联生成结果。把物种不变量与个体差异分开。 | [consistency L20–38、55–67](https://github.com/scenario-labs/skills/blob/5786accd3bb6d79808330230c698898862e8a1d4/skills/scenario-consistency/SKILL.md#L20-L38)。seed不能单独锁定身份；仅改贴图不能消除轮廓重复。 |
| C2图→模型差距大，却被工程通过掩盖 | 先写可见的pass/fail条目；每张/每个资产独立判定；局部缺陷局部修、整体漂移回基线、限定重试。原始模型先核对轮廓再绑定，不能扭曲比例迁就旧骨架。 | [refine-loop L11–49](https://github.com/scenario-labs/skills/blob/5786accd3bb6d79808330230c698898862e8a1d4/skills/scenario-refine-loop/SKILL.md#L11-L49)、项目C2验收历史。需要增加“参考图 vs 真正Godot成品”阶段。 |
| 自动批量容易丢来源、重试重复收费 | 记录prompt、参考哈希、模型/schema版本、job/asset ID、价格、阶段结果和本地导出资产；超时继续等同一job，传输失败先查任务。workflow按子节点核算费用。 | [核心L50、73](https://github.com/scenario-labs/skills/blob/5786accd3bb6d79808330230c698898862e8a1d4/skills/scenario/SKILL.md#L47-L73)、[workflow L48–58](https://github.com/scenario-labs/skills/blob/5786accd3bb6d79808330230c698898862e8a1d4/skills/scenario-workflows/SKILL.md#L48-L58)、[PATINA L40](https://github.com/scenario-labs/skills/blob/5786accd3bb6d79808330230c698898862e8a1d4/skills/scenario-patina-retexture/SKILL.md#L34-L44)。元数据不能代替视觉验证；本地manifest应继续作为交付依据。 |
| 多视图和动作分解图互相漂移 | 先审单张，再拼审核sheet；共同人物基线、视角、尺度、地面线；动作各相位明确。错误panel单独修复。 | [storyboards L17–35](https://github.com/scenario-labs/skills/blob/5786accd3bb6d79808330230c698898862e8a1d4/skills/scenario-storyboards/SKILL.md#L17-L35)、[identity-library L25–35](https://github.com/scenario-labs/skills/blob/5786accd3bb6d79808330230c698898862e8a1d4/skills/scenario-identity-library/SKILL.md#L25-L35)。需加项目要求的支撑脚、重心、手脚路径、接触、恢复/打断，通用故事分镜不会自动包含这些。 |

## 需要改造：有工具或代码，但离项目闭环仍有距离

**材质、地形与生态。** [textures](https://github.com/scenario-labs/skills/blob/5786accd3bb6d79808330230c698898862e8a1d4/skills/scenario-textures/SKILL.md)包含可平铺纹理、专用放大、PBR贴图和2×2接缝检查；[PATINA L11–44](https://github.com/scenario-labs/skills/blob/5786accd3bb6d79808330230c698898862e8a1d4/skills/scenario-patina-retexture/SKILL.md#L11-L44)按岩、尘、织物、金属等物理族复用一套贴图。源码[apply_materials.py L1–45](https://github.com/scenario-labs/skills/blob/5786accd3bb6d79808330230c698898862e8a1d4/skills/scenario-patina-retexture/scripts/apply_materials.py#L1-L45)确有manifest、贴图角色和几何hash设计。

这可以改善玄武岩/风化岩/矿壳的表面，不能生成120km星球的权威高度场、水系、地质和物种分布。需接项目实际米制纹理尺度、shader、颜色空间、法线方向、LOD/纹理预算和生物群落规则。PATINA文档明确GLTF不能直接保留其完整shader图，需烘焙；smoothness标签与实际roughness值有陷阱，不能按名称机械接线。height贴图本身不产生真实坑或碰撞。

**图→3D→Blender→Godot。** [3D技能 L27–43、67–91](https://github.com/scenario-labs/skills/blob/5786accd3bb6d79808330230c698898862e8a1d4/skills/scenario-3d/SKILL.md#L27-L43)及[官方Meshy](https://docs.scenario.com/get-started/generation/3d-model-generation/3d-model-generation-meshy)确实覆盖多视图网格、PBR、remesh、UV、rigging和animation。适合一个经批准的树/岩/道具候选。取得GLB后仍需检查隐藏面、树叉/石层、单位朝向、UV、轮廓、材质、LOD、碰撞体、底部接地；生成树不会自动拥有可毁断面、断枝骨架、掉落逻辑和持久化状态。

Blender专家家族更贴近项目已有制作路线：多角度silhouette/matcap/wire检查、权重与关节变形审核、blocking后再spline。作者声明Blender 5.2.1下12套headless测试通过，同时指出雕刻头模只到概念质量，精细面部拓扑仍需人工。本项目旧文档记载5.2.1，版本看似匹配，**本轮未复核当前安装，也未验证项目C2 19骨架兼容性**。其面向Z-up/-Y和Rigify的默认需适配Godot Y-up/-Z、项目根位移和现有权威骨架；不能直接重绑生产角色。

**走跑、武技与VFX。** 不应把Scenario等同于“只输出视频、没有骨骼动画”：官方Meshy列出自动rig、预设action以及text-to-motion（FBX/BVH片段）；官方还列有[Uthana](https://docs.scenario.com/get-started/generation/3d-model-generation/3d-model-generation-uthana)、[Cartwheel](https://docs.scenario.com/get-started/generation/3d-model-generation/3d-model-generation-cartwheel/)绑定路线。仍不保证动作符合批准的支撑/重心/武技时序或兼容C2。库动作/文本动作只是候选，不能跳过项目image分解→审核→3D制作的要求。

[sprite-animation](https://github.com/scenario-labs/skills/blob/5786accd3bb6d79808330230c698898862e8a1d4/skills/scenario-sprite-animation/SKILL.md)可制作二维特效帧、切片和视频取帧，需检查顺序、alpha、基线和循环；也可借作动作参考，但不是三维连续蒙皮。技能VFX仍要落到Godot网格/粒子/拖尾/光/声音，与真实释放、命中、落空、中断事件对齐；不能用一张火焰图或特效视频充当空间效果。[Unity](https://github.com/scenario-labs/skills/blob/5786accd3bb6d79808330230c698898862e8a1d4/skills/game-engines/unity/README.md)确有C# VFX等代码，作者测试为macOS Unity 6.3；[Unreal L22–28](https://github.com/scenario-labs/skills/blob/5786accd3bb6d79808330230c698898862e8a1d4/skills/game-engines/unreal/README.md#L22-L28)明确没有在真实UE中运行。这些不是可直接加载的Godot特效包。

**自动审核。** [asset-analysis L17–31](https://github.com/scenario-labs/skills/blob/5786accd3bb6d79808330230c698898862e8a1d4/skills/scenario-asset-analysis/SKILL.md#L17-L31)真实提供批量图像分析、caption/style/control-map；所有四类分析均可能收费，read-class不代表免费。[quality-gate L11–26、49–61](https://github.com/scenario-labs/skills/blob/5786accd3bb6d79808330230c698898862e8a1d4/skills/scenario-quality-gate/SKILL.md#L49-L61)仅审核图片、需Enterprise add-on，存储结果读免费但新分析收费。仓库指出它看不到原始参考，物理不可能的局部也可能高分通过。它不能验收GLB、碰撞或整段运动；原图并排审核和真实引擎视频必须保留。

## 不能直接解决的项目问题

| 问题 | 能辅助什么 | 必须由项目自己完成 |
|---|---|---|
| 可毁树岩、真实地形坑 | 断裂设计参考、断面材质、碎片网格候选 | 权威命中/破坏状态、同步可见网格与物理碰撞、重新支撑生态、掉落去重、存档恢复。现有PLANET-NATIVE-CONTRACT已连接稀疏坑记录和mesh/collider提交，不应重新用贴花替代。 |
| NPC/敌人战斗智力 | 行为可读的动作/VFX参考；Unity/UE gameplay例子作为异引擎思路 | Godot视线记忆、可见威胁、预测/避让、回巢/落地、导航和NPC交互。Scenario生成API不是游戏决策服务，也不能替代现有NativeAIDecision或解决待复测的E/落地问题。 |
| stream/query尖峰、森林重载 | 更合理的面数/材质/LOD资产预算；异引擎性能方法 | Godot实测CPU/GPU和p95/p99尖峰，流送任务调度、缓存失效、支撑查询、MultiMesh/碰撞生命周期。本轮没有性能改善证据。 |
| 120km星球/旧盆地/存档闭环 | 景观与材质参考、静态场景候选 | 球面坐标、径向地形/重力、浮动原点、真实地面ready、载具/调查/存档迁移。生成world/splat不能证明可玩、可碰撞或兼容旧游戏。 |
| 精确还原C2、自然走跑 | 参考锁定、局部修图、权重/动画检查工具 | 人工修形与动作设计、现有19骨架适配、原图对照和正常速度连续检视。不能由质量分数或若干关键帧替代。 |

这里的“不能解决”指不能直接交付星渊运行效果，不是断言仓库完全没有泛用动画、AI、破坏或性能资料。

## 账号、费用、授权和资料漂移

1. 源码为[MIT](https://github.com/scenario-labs/skills/blob/5786accd3bb6d79808330230c698898862e8a1d4/LICENSE#L1-L21)，复制实质代码/文档需保留版权与许可；MIT不授予Scenario服务额度，也不代替软件或生成资产许可。
2. MCP为`https://mcp.scenario.com/mcp`，核心技能推荐OAuth账户登录；REST官方[认证说明](https://docs.scenario.com/get-started/documentation/quick-start-guide/step-2-authenticate-your-requests)要求API key和secret。API按[条款7.1](https://www.scenario.com/terms-and-conditions)的eligible plans开放，模型还受团队权限/可用性限制。本轮没有查账户、密钥、额度或区域可用性。
3. 生成/分析/训练等消耗CU。仓库里的17CU材质、1CU审核是编写时示例，不是当前报价；没有核实可靠的当前人民币/美元订阅数字。[API dryRun](https://docs.scenario.com/api/resources/generate/methods/run_model)可估算具体请求（269响应）；报价不等参数一定运行成功，后续步骤还需真实输入才能精确报价。启用`ipDetection`即使dryRun也可能有检测费，不能把所有dryRun组合视为免费。本轮未请求任何报价接口。
4. [价格页](https://www.scenario.com/pricing)FAQ称付费计划可商用、免费输出限个人/评估；[条款4.3、7.4](https://www.scenario.com/terms-and-conditions)称生成资产归用户、商业用途受计划范围约束。应按具体计划核准后再入正式游戏，不能由repo MIT推出免费输出可商业发行；第三方模型另有适用使用政策，AI输出不保证唯一或不侵权。
5. 官方表述存在数据治理差异：价格页宣称不训练/不共享，最新条款4.6对自助账户保留改进服务及AI的内容使用权，Enterprise MSA/DPA才给契约no-training保障；9节也说明第三方处理因模型而异。未来上传私有角色图前需用户选择并核准适用计划/条款，不据宣传假定绝对不训练。
6. **模型资料有漂移。** 仓库Meshy技能写Ultra只接受单图，官方自动模型页却描述多视图Ultra；官方还列text-to-motion，而当前Meshy技能未详细覆盖。identity-library L35允许缺槽时sheet参考，consistency L67却反对sheet进入参考槽。项目应优先独立批准视图、实际schema和小样验证，不机械执行任何一段SKILL。
7. 默认安装从main拉取且不固定版本，未来若选择借代码应冻结审核过的SHA。此研究仅把SKILL当证据，没有采用其自动安装、生成、上传、发布或默认三轮开支指令。

## 最多三个低风险试点与验收

**1. 本地资产审核与追踪模板（优先，不需服务）**：只选已有C2背甲、树岩、走跑和一项武技的现存参考与成品证据，不重做资产。制定稳定ID、原图哈希、不可改变的部件、候选/源文件/导出/Godot路径、视觉缺陷与费用字段，整理统一视角对照。验收：故意含已知背甲对称或脚滑缺陷的历史候选必须被明确判fail；所有记录能追到原图和最终文件；不以数值通过覆盖视觉fail。开发整理与独立审核分工，保留未通过状态。

**2. 一族岩石材质的小样**：未来明确批准费用和上传范围后，只做一族玄武岩或风化岩PBR，不动生产地形和碰撞；先审核材质参考图再应用到隔离网格。验收：2×2平铺无明显接缝、roughness/normal方向和米制尺度正确；相同网格/相机/光照下Godot近中远对照，侧光没有烘焙阴影；几何、碰撞和旧盆地存档保持一致；报告目标设备帧耗时/纹理预算。更好看但过度重复或失真仍不通过。

**3. 单个树或岩石的端到端试制**：未来仅批准一个候选和明确的修正次数/费用上限；先生成批准多视图（不重绘既有批准视图），再选服务网格或本地Blender制作，保留源文件。验收：八角度轮廓、树叉/石层与底部对照；Blender隐藏面、UV/PBR、LOD与碰撞检查；Godot正常距离环视、坡地接触、近远LOD切换和加载/卸载；manifest贯穿image→mesh→blend→glb→引擎证据。不合格停在候选，不替换生产生态；可毁行为不在此试点中假装完成。

本轮验证是文献与源码读取、版本冻结、项目合同对照、证据链接检查。未开展任何生成/引擎实验，因此没有新的图像、网格、帧率或玩法通过结论。未来接入需用户明确选择试点和服务/预算范围。
