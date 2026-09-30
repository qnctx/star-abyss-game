# 🪐 星渊迷航 — 开发进度看板

> 最后更新：2026-09-29
> 仓库：https://github.com/qnctx/star-abyss-game  
> 本地：E:/myProject/star-abyss-game/

## 2026-09-30：Scenario skills 只读研究

- 完成[研究报告](docs/research/scenario-skills-review.md)，冻结原仓库 `5786accd3bb6d79808330230c698898862e8a1d4`；实际读取相关 SKILL、本地 Blender 代码及官方 API/模型/价格/条款，对照星渊原生工程合同。
- 可借鉴固定参考变体、材质分族、逐项视觉审核和批次来源追踪；网格/绑定/动作有真实服务路线，但没有 Godot 适配，不能替代破坏碰撞、AI 或 stream/query 优化。已记录模型文档漂移与商用/数据治理表述差异。
- 本轮未安装、执行第三方脚本、连接账户、上传资产、调用生成/分析或使用凭据，未改产品或占用 GPU。三个建议试点均未执行，未来接入须由用户明确选择范围与预算。
- 复核步骤：按报告固定 SHA 打开源文件/行号，核对官方模型与费用/条款；本地先用已有失败候选检验审核清单。未来制作必须先 image 分解审核，再在 Godot 正常速度对照成品；报告不声明新增美术或功能通过。

## 2026-09-29：C2 走跑动作 R6（本地原生 Godot）

- 后续质量反馈：当前走跑视觉效果未获认可，工程通过不代表自然度通过；已追加[同视角/同相位视觉验收条件](godot/assets/motion-r2/gait-r6/VISUAL-ACCEPTANCE.md)，本轮仅审核文档，未追加图像或改动3D。

- 用户批准参考图后，完成 walk/jog/sprint 的 Blender/GLB 与运行时接入；保留原网格、绑定、其余26动作，未改玩法速度、世界与存档。
- 真实Godot三视图、完整GPU蒙皮抽样、1537帧既有适配器回归通过；完整月面场景合成输入达到1.6/6.8/10m/s并正常减速。独立验收限定为平地直行，坡面和真人手感待试玩。
- 测试：第三人称 Ctrl+W / W / Shift+W，观察摆腿、后收小腿、对侧摆臂及松键；再检查倒退、侧移、转向、坡面。详见[交付、可旋转预览和复测命令](godot/assets/motion-r2/gait-r6/README.md)。
- 实际工作树：C:/Users/HUAWEI/.codex/worktrees/3ff0/star-abyss-game；原有脏改动保留。

## 当前 HTML 迭代 · 静默回声

### 2026-09-12：十方顶层势力与关系故事（设计补充）

- 新增D3-29，一神国/二洞天/三学府/四圣地，最高人物战力严格为99、98/97、97/96/96、95/95/95/95。总等级映射与技能掌握分开。
- 增加20支门派与30位具名NPC，固定名册68名；六幕故事、个人信任/仇怨/组织关系分离，组队、误会、背叛和斩杀后继任均保留原物账。
- 同步图文手册及媒体v005；本次仅设计修改，不干预新总控已集成模块与独立测试流程。

### 2026-09-12：同根存档联动交付进入独立验收

- 验收完成：TEST-I-R1独立Node10/10、真实IDB10/10（53步骤），六按钮操作与刷新后全根一致通过。已按哈希集成DEV-I-R1，主目录Node13/13；保存完整报告及57份证据，未改现有入口/资产。下一切片为真实R0 3D战斗采集入包，尚未完成3D验收。
- DEV-D1真实R0场景已确认运行（01a094f4-f011-7893-b92b-4005f9a918c8，b53c工作区），范围为真实战斗/掉落/采集/有限背包/根重载；交付后单独新建实操TEST。加工D2及同宠E尚未启动。
- D1发现checkpoint/救援接口缺口：已派DEV-I-R2补同根场景保存与同档保包救援，完成后新建独立测试。D继续3D工作，不绕过根事务写血量或以重开试炼替代救援。
- D1阶段自报：空间逻辑5/5、真实Three画面已加载；已移除自有根CAS。I-R1缺checkpoint导致入口明确暂停，尚非可玩闭环验收；待独立通过I-R2后接线。
- I-R2开发完成冻结，场景快照/同档救援接口与33文件哈希已核验；已提交全新TEST-I-R2，独立结论未出，主项目仍保留已验收I-R1。
- I-R2独立验收完成并集成：新独立Node/真实IDB各10/10、原独立回归各10/10，实际救援/后续进度/刷新全根一致；主目录14/14。3个旧文件经原哈希核对后升级，证据独立归档。已通知D1使用已验收R2继续3D实操，尚不能标D1通过。

- DEV-I-R1已交付：开发Node13/13、真实浏览器IDB6/6。总控核验13个自有文件与7个依赖哈希，冻结真实版本后提交全新TEST-I-R1创建；未将开发自测当验收。
- TEST-I-R1正式ID已核实为01a094e7-7175-7362-8dbf-878bcc485e6a，62b6工作区，独立验收运行中；暂无结论。
- 独立复核步骤：核对冻结哈希→独立端口启动同版本→采收/死亡/唯一转移整根保存→真实IDB abort/并发/丢响应重载→实际刷新及按钮操作留证。独立通过前不集成，3D主场景仍未接入。

### 2026-09-12：新总控核实三开发交付并发起独立测试

- 第一批模块验收完成：A-R2独立50/50通过并集成，主目录战斗22/22；B-R1独立通过、主目录库存17/17；C-R2独立通过、主目录世界21/21。失败R1与修复R2报告/证据均保留。下一步同根保存联动，之后真实场景；当前不标玩法已实装。
- DEV-I同根存档联动任务已确认正式运行（01a094d9-4b8a-7890-a238-0effc66ca873，7737工作区），限定根事务协调与真实IndexedDB CAS，交付后另建独立TEST-I；状态与版本见任务登记。

- 验收追加：B-R1独立13/13通过，源码按哈希局部集成，主目录定向测试17/17通过；C-R1独立9/10，发现历史碎片ID复用；A-R1独立13/17，发现精度漏杀与别名ID冲突。A/C均已退原DEV修复R2，联动/场景尚未就绪。
- C-R2追加：全新独立复测39/39通过，历史片复用F01关闭；已按哈希局部集成，主目录world-director测试21/21通过。A-R2已冻结交付，全新TEST-A-R2正式任务已确认运行；当前模块仍未接入场景。

- 已通过正式任务读取与实际文件核验DEV-A/B/C；对应2f23/bb9f/8712工作区，开发自测分别16/17/19项通过。已通知开发冻结实现并改由新总控调度。
- 总控按字节保存DEV-A/B/C-R1快照与逐文件SHA-256，分别提交全新TEST-A/B/C-R1创建。测试创建回执暂不算运行或通过，实时状态见[任务登记](docs/development/TASKS.md)。
- 验证步骤：核对manifest哈希→运行对应真实实现和自测→独立边界/失败恢复用例→报告明确结论；失败回开发并新建复测。当前未集成、未接入场景，主项目原有脏改动保留。
- 第19章及离线图文手册的中间算术纠正为291.714133333…；BigInt有理数复核后最终生命损失仍为241，未改公式或历史图片。

### 2026-09-12：全新总控会话与独立功能验收

- 用户要求总控移交全新会话。新增[交接单](docs/development/HANDOFF.md)，原会话停止后续调度。
- 流程改为开发交付→单独新建TEST功能会话直接验证→失败回开发→新版本独立复测→通过后审核集成；模块、场景与联动验收明确区分。
- A/B/C目前只有创建回执，工作区已建立但正式任务ID未核实；新总控先核验登记，禁止误报完成或盲目重复创建。

### 2026-09-12：启动文档总控的前期并行开发

- 新建[开发总控](docs/development/CONTROL.md)和任务登记，第一批划分战斗数值、库存事务、消耗驱动刷新/唯一账本三个独立工作区任务。
- 主工作区未提交代码与资产保留，分对话只读取最新设计；模块定向测试通过后由主对话审核集成，再做真实场景。当前不将任务创建视为玩法实装。

### 2026-09-12：纠正同一宠物的日常/战斗模式

- 当前随行只有一只宠物，日常为迷你跟随，战斗展开完整体型，共用身份/生命/灵力/冷却；取消双宠并行与独立陪伴宠槽。
- 区分同宠变形与60秒换宠规则；接敌可展开，缩回需脱战，过渡无回血/无敌/复制。同步15/17/18/21、总览、规则图v002及图文手册；媒体v004保留历史版本。
- 复核：重建手册与文档审计，查看15日常/战斗段落及图解；本轮为文档纠正，未改运行代码。

### 2026-09-12：地图开荒与动态游历人物

- 新增D3-28：8类地图与真假/版本/通行资格，12类动态游历NPC，真实采集、战斗、死亡、隐藏意图、夺宝、销赃和追赃。固定38名NPC不变。
- 明确普通昏迷保包的劫修例外：搜夺可打断，物资转移受负重限制，原器、残图与赃物沿原ID流转；新人换身份不能复制旧人遗产。
- 更新29章图文手册及媒体v003清单。文档复核与浏览器显示检查；后续按TN01—TN12验证地图引路、真实采集、一次普通抢夺追索再接唯一宝物。当前未实装AI/3D。

### 2026-09-12：消耗驱动刷新与世界唯一复核

- 新增D3-27，文档包28份。消耗提交产生一次性空缺，冷却到期只提供补充许可；新代必须换ID和实际组合，不重抽未取物品质；建筑区分清理后的新事件与授权扣料重建。
- 原器/道统/异格/核心机缘采用世界根唯一账，跨角色与多来源共用，交易、丢弃、拆片、删除角色不复位。取消普通未领掉落15分钟自动删除，按锚点限制未结算容器。
- 同步08/09、经济、联网、建筑、逆天传承及图文手册，增加消耗换代图，保留媒体v001并新增v002清单。本轮仅设计修订，无运行模块改动。
- 复核：文档审计→离线图文检查；后续实现按27的RF01—RF20验收未采不刷、半采不换、满包不扣、不同新代、原器交易/重铸不复制等场景。

### 2026-09-12：图文手册与逆天传承

- 新增25图文阅读路线、26逆天传承，共27份规格；各章添加规则概览图，制作可离线搜索/选章/打印的HTML图文手册，以及1张内置imagegen三联概念插画。提示词与SHA-256存入独立媒体清单，未生成3D模型。
- 增加6功法/6禁传武技/6遗兵/6神宠异格/6机缘；一气化三清明确双道身、五阶继承、归一属性、共享资源/CD和临时生命，附越境对照算例。普通成长与极稀有天命核心分层，神宠仍归原33谱系。
- 检查路径：运行文档审计和图文检查脚本；离线打开手册→搜索分身→查看26→切换19核算→窄屏检查表格可滚动。新玩法仍属设计，尚未实机验证同级胜率或越境战斗。

### 2026-09-12：武技、宠技数值与宗门阵法设计

- D3新增19—24，文档包共25份。人物60式、宠物66主动/33天赋，沿用五阶掌握，逐项列系数、门槛、资源、命中与专属3D表现；统一加减乘除顺序和盾/抗性/控制上限。
- 新增6宗门、12名NPC（固定总数38）、12任务模板、20兑换项、12建筑、12阵法；补加入/访学、比武、建宗、供能、覆灭/救援/重建及单机联网边界。
- 本轮只设计和定向文档审计，未改运行代码/存档、未制作新3D或消费积分。19手算实例最终损失241生命；运行平衡和打击感须在后续白盒验证。
- 复核：执行 `node artifacts/cultivation-doc-audit.cjs`；按19核算→20/21技能表→22五阶动作→23任务兑换→24阵法破坏重建检查。未来先做两招、一个任务和一座真实阵法闭环，再扩目录。

### 2026-09-12：33种宠物系统与资产维护设计

- D3新增15—18，现十九份。包含33种谱系/七档血脉/十境成长、孵蛋与四档野生收服、兽诀、稀有破限、迷你陪伴、骑宠地空战及专属服装。
- 增加灵兽医师林蘅、兽装师织翎，固定NPC现26名。补人物/宠物命名、个体花纹与主人纹章、同名实例归属，以及宠物与普通储物的边界。
- 制定不可覆盖的媒体版本与哈希/来源归档，盘点现有资产并建立33条planned宠物注册表；清单不等于独立备份。本轮未生成宠物图/视频/3D、未消耗aholo积分，未改运行代码。
- 复核步骤：查看16图鉴→15收服门槛→17载飞/载重→18身份；随后实现PET09地面样板和PET17载飞样板，更新实机录像与资产清单。

### 2026-09-12：储物、洞府、药物与追逐补充

- D3 新增第 10—14 文档，现共十五份。背包/货舱有格数、容积、负重，六档袋戒、七种扩容材料与后天六级起的 NPC 刻纹教学已定义。
- 随机洞府使用角色独立机缘种子，区分普通洞府与极稀有永久机缘；补定居仓储、修炼设施、八种功能丹/后遗症、十境独立地速与感知追逐。
- 同步覆盖旧同速、固定机缘、未定义容量/钱包的假设，保留单机优先与未来在线角色/资产隔离。仅设计与文档校验，未改运行代码、未生成收费资产。
- 复核步骤：从 D3 入口依次检查 10 的容量/扩容表、11 的洞府概率、12 的药效/债务、13 的速度/追逐例子、14 的联网归属；后续在 C1—C6 实现时追加对应实机测试。

### 2026-09-12：世界刷新系统设计

- 新增 [世界刷新规则](docs/cultivation/08_WORLD_DIRECTOR.md) 和 [配置/开发面板](docs/cultivation/09_WORLD_DIRECTOR_CONFIG_AND_TOOLS.md)，D3 文档包现共十份。
- 决定留在当前游戏仓库，逻辑、数据、适配层和调试入口独立；不新建项目/服务。刷新与区域、任务、掉落、材料、境界和存档绑定，后续按 WD0—WD6 嵌入 C0—C10。
- 明确代数与独立随机流、不会当面凭空刷怪、低境区不随玩家升级、离线只恢复有限再生资格而不自动产出奖励、主线材料可达与商站独立补货。
- 本轮仅文档与结构校验，未修改游戏代码或用户存档。复核步骤：读 08 的刷新/时钟表，对照 09 的 Z0 样板与 WD 阶段，再检查配方可达性和去重规则。

### 2026-09-12：科技进化转修真 · D3 玩法文档

- 完成 [八份分模块开发文档](docs/cultivation/README.md)：后天 R0 至道源 R9、每境十级，战斗/武器/功法，三十制剂配方、灵石/交易、二十四固定 NPC 与对话、三十生物和两类机关、母星六区及跨星路线。
- 明确 72 小时离线修炼封顶且不自动跨境、稀有内丹与无核突破替代路线、同境构筑差异、失败救援、200 米飞行器/R5 御空/R8 星空/R9 毁星边界。
- 新增 C0—C10 开发切片并给旧 D2 文档加覆盖说明。本轮仅设计和文档检查，未改游戏运行规则、未生成怪物模型、未消耗 aholo 积分；后续先做一场战斗到炼丹成长的真实闭环。

### 2026-09-12：趴卧动作、同源 3D 与下车转向

- 重做弯肘支撑、交替屈膝、张开手套和分段趴下/起身；镜头跟随头部眼点，调整第三人称趴姿机位。
- 退出车辆清除残留环视状态，对齐身体与观察方向，无需 Alt 即可鼠标转向。
- 导出同源四段动画 GLB 和 Blender 文件，281/281 规则通过。资产、截图、限制及复测见 [趴卧重构](docs/PRONE_REDESIGN.md)。

### 2026-09-12：驾驶第一人称与同车 3D 仪表

- 解除驾驶时强制追尾和 V 禁用，驾驶第一/第三人称偏好独立存档；下车恢复步行视角。第一人称镜头坐在真实座椅位置，随车转弯，鼠标环视不改变车向。
- 用 imagegen 生成与现有开放式勘探车对应的设计图，再接入同车世界空间仪表、双握把和第一人称手套/前臂。车速、电量和刹车状态读取实际数据。
- 从运行时同一构造器导出 GLB，保存可编辑 Blender 源文件；哈希断言防止交付模型落后于游戏。无 aholo 积分支出。
- 277/277 规则与驾驶定向浏览器验证通过。设计、资产、截图和复测步骤见 [驾驶第一人称](docs/VEHICLE_FIRST_PERSON.md)。

### 2026-09-12：第一人称修正与扫描器收放

- 第一人称实际视线统一，补齐嵌入浏览器鼠标拖动坐标回退；Z 不再误判轻微地形支撑为墙，按住 Ctrl 时也能切换姿态。
- Q 扫描、E 闪避替换探身；Space 轻按跳跃、长按升空，保留 G 直接助推，F 交互。菜单与 HUD 同步。
- 先用 imagegen 制作设备/动作设计图，再用本地 Blender 制作扫描器、左右手和折叠翼，接入取出→扫描→合拢→收回。默认空手，本轮 aholo 支出 0。
- 274/274 规则通过；实际第一人称/无锁拖动浏览器验证通过，包含转弯、Ctrl+Z、跳跃/飞行落地、解锁后 E 闪避 4m、扫描生命周期和重复使用资源稳定。源文件、截图与人工复测步骤见 [第一人称装备说明](docs/FIRST_PERSON_EQUIPMENT.md)。

### 2026-09-12：PUBG 风格键鼠与低姿态（历史键位，以上方更新为准）

- 核心键位调整为 WASD/鼠标转向、Shift 疾跑、Ctrl 按住慢走、C 蹲伏、Z 趴下、Space 跳跃、Q/E 探身、Alt 环视、= 自动前进、F 交互、M 地图；装备动作迁到 G/L/X/B，原剧情与资产保留。
- 调整前后侧移速度与起步/反向/停步响应；新增真实跳跃和落地、低姿态碰撞/净空、全身蹲伏片段、本地趴卧爬行骨骼动作、姿势镜头高度和探身避障。修复趴下时第三人称支点触地导致角色隐藏的问题。
- 完整按键表、速度、来源和复测步骤见 [桌面控制说明](docs/PUBG_STYLE_CONTROLS.md)。最新测试状态见 [验收台账](docs/HTML5_VERIFICATION.md)。本轮无 aholo 请求或积分支出，不宣称 PUBG 原版动捕或完全一致的手感。
- 最终规则 266/266；姿态专项 49/49 规则与1/1浏览器通过，倒退/侧移/慢走恢复定向回归通过。完整移动首次14/15，两个阶段的测试夹具/短暂状态采样问题均已修正并定向复测，保留原失败报告，不宣称一次完整发布回归通过。

### 2026-09-12：疾跑鼠标转向与 Alt 自由视角

- 普通鼠标同时控制镜头与身体朝向，W+Shift 疾跑可以连续拐弯；A/D 保持侧移，方向键仍可辅助转身。
- 按住 Alt 时只转镜头，继续接受 W / Shift / A / D；松开后按最短角度平滑回到身体前方，不改变身体朝向。失焦、暂停与指针锁丢失清理 Alt；Alt+Tab 保留系统行为。驾驶依旧 A/D 转向、鼠标环视。
- 新增转向控制模块和回归测试，操作说明同步到游戏菜单、HUD 与 README。浏览器实测疾跑转弯、Alt 环视、回正、侧移和失焦清理通过，1440 / 768 / 640 宽度提示无裁切。结果见 `artifacts/look-control-20260912/browser-audit.json`。
- 人工复测：W+Shift 跑动时左右移动鼠标；按住 Alt 看侧后方，松开确认镜头回正；随后 A/D 侧移，再切出窗口返回确认没有持续跑动或环视。

### 2026-09-12：C2 按原图重做并接入游戏

- 用户否决首轮外观后，改用原始六视图的无损裁切直接建模；aholo 任务 `3412174` 报价 20 积分，本会话累计 64 / 300，剩余授权额度 236。
- Blender 保留原始身体比例，补做偏置背甲和琥珀脊柱；通过封闭代理网格计算权重，转回实际衣服网格。游戏使用独立的 19 骨架，动作适配保留骨段长度并校正待机手臂外张。
- 已接入 67,754 三角面的新 GLB，旧生产模型保存在 `artifacts/c2-lux3d-20260912-r2/previous-production.glb`。原图、源网格、可编辑 `.blend`、交付预览和验证结果在同目录。
- 验证：256 项规则/适配测试通过；浏览器检查站立、行走、跑步、前后左右移动及离线第三人称加载，无页面错误或蒙皮数值异常。头盔轮廓、缝线和细微材质仍有参考图差异，未宣称用户美术验收通过。
- 复测：刷新 `docs/ui-implementation/c2-character-preview.html` 切换动作；打开 `playable/star-abyss.html` 开始游戏，按 V 切换第三人称，再用 WASD、C 和 Shift 检查移动。

### 2026-09-11：C2 首轮真实资产生成与接入

- aholo 中国站生成一个 C2 模型，四视图 24 积分 + 标准版网格 20 积分；账户观察余额 900→856，本轮 300 积分上限未扩大，无重复生成。
- Blender 完成比例适配、背部 S 壳补建、19 骨架自动权重和本地减面；游戏版约 4.4 万三角形，保留原始 GLB/ZIP 与可编辑 `.blend`。
- 新蒙皮复用现有移动、脚底接触和动作系统；离线游戏/检视页内嵌同一 GLB，避免 `file://` 读取被拦截。当前是可运行首版，不代表参考图级美术验收已通过。
- 检视入口：`docs/ui-implementation/c2-character-preview.html`；任务、费用、实际文件和检查记录：`artifacts/c2-lux3d-20260911/`。复测按 `docs/C2_REFERENCE_ACCEPTANCE.md` 的本轮步骤。

### 2026-09-09：待机稳定修正 / C2 美术重新打开

- 当前补丁 `C2-IDLE-FIX-20260909`：固定待机骨盆、根平移和双腿姿态，保留上身呼吸，避免持续触发足底修正。纯方向行走片段的量化指纹不变。
- C2 美术被用户否决：当前程序化网格与参考六面图明显不同，不能算替换完成。缺少对应三维角色资产；见 `docs/C2_REFERENCE_ACCEPTANCE.md`，不再通过近似网格配色宣称还原。
- 全量规则 254/254 已通过；完整移动专项 120/120 规则、15/15 浏览器通过（569秒）。生产模型20秒待机检测髋膝踝/足点漂移为0且保留呼吸。仅专项通过，未上线；最终台账见 `docs/HTML5_VERIFICATION.md`。

### 2026-09-08 历史切片

- **C2-ASSET-PERF-20260908**：按参考方向实改大 V 领肩胸甲、象牙石纹 / 灰褐织物及各自独立 bump，4 张 512 纹理一次生成，预算 5.33 MiB；移除旧材质生成器，强化肘膝褶皱，修正小腿穿插和后脑过大黑件。仍是程序化模型，不计参考图 1:1 高精度还原；以实际 3D 验收页而非概念图判断效果。
- 装甲深度细分 2→1、闭合结构保留，布料环距 0.011→0.018；蒙皮按全部属性安全索引合并，角色预算由约 71,500 降至 45,000 三角形以下。岩石最终按 768 m 分块视锥剔除：256 m 方案绘制 238 次，调为 768 m 后 161 次，基线 138 次；世界顶点、法线与碰撞保持一致，不通过距离删除遮掩空地。动态渲染比例 0.65–min(DPR,1.25)，含热身 / 迟滞，只改 3D 画布，不改 UI 或模拟；HUD 复合 DOM 仅数值变化时重建。
- 动画缓存优化保持相同轨迹；Node 混合 6,000 次调用微基准 99.990→56.839 ms，不能解释为 FPS 提升 43%。1440×900 无头基线 p50 / p95 为 416.7 / 433.4 ms；未接岩石分块的中间 after 为 299.9 / 366.7 ms，不作最终提升证据。768 m 最终 tuned 为 383.3 / 483.3 ms，P95 反而恶化、结果波动，未证明实机流畅或稳定 60 FPS。原始采样未记录真实 GL 驱动，不能据此断言软件渲染；追加 verified 已记录 ANGLE Google Vulkan SwiftShader Device (Subzero) / SwiftShader driver，确认为该次无头软件渲染；p50 / p95 / max 为 349.9 / 433.3 / 450 ms，比例 0.65，161 draws / 379,840 triangles。只证实本测试环境原生渲染耗时占主导，不能推定用户设备驱动问题或旧基线同驱动，不保证实机改善比例。全部原始数据保留于 `docs/ui-implementation/locomotion-profile-*.json`。
- 最终 768m 代码 **253/253 Node** 通过（20.4 秒）；movement 单次门禁规则 **119/119**、浏览器 **14/14** 通过（690 秒），状态 `FEATURE_PASSED_NOT_RELEASE`，被测指纹前后一致；子集规则不与全量相加。构建及角色预览已更新。试玩：刷新核对新版本 → V/C 与四方向 → 连跑 10 秒环视 → 舰内外 → Tab 返回 / Space 助推 / 驾驶 → 六动作八角度实际预览。还需画面自然度、实际硬件性能与完整发布验收；以下 C2-FREELOOK 及更早计数是历史结果。

- **C2-FREELOOK-20260908**：鼠标仅环视，W/S 相对身体前后，A/D 真侧移，←/→ 转身体；V/C 保留。`heading` 独立入档，旧档缺字段从观察 `yaw` 迁移；R 闪避同步身体前方。默认前 / 侧 / 后速度 4.7 / 2.4 / 2.2 m/s，慢走 1.65 / 1.3 / 1.2 m/s，仅前向可冲刺，斜向连续混合限速，飞行 / 驾驶显式速度不受步行限速影响。
- C2 程序化矿壳 / 织物模型及八角度检查已接入；后退 / 侧移动作是全身前进片段的解析重定向，非新独立动捕，也不是概念图级扫描资产。概念图：`docs/ui-concepts/c2-independent-20260908/{turnaround,keyposes}.png`；实际验收：`docs/ui-implementation/c2-character-preview.html`，支持 6 动作、播放 / 单步、八角度，`npm run preview:avatar` 重建。
- 本切片规则 **246/246** 通过；相关浏览器分批复测 **14 项** 通过（动作玩法 10、角色比例 1、C2 方向/八角度/离线预览 3），不拼接成一次全量发布回归。修复侧步刹停方向回弹、窄屏预览画布溢出；地图区分身体箭头和视线短线，下车身体对齐车身而保留环视。`movement` 独立测试组纳入新用例。试玩：刷新核对版本 → V → W 行走同时鼠标环视 → S/A/D 倒走及侧移 → ←/→ 转身再 W → C 四方向慢走 → 前向 Shift → 读档核对身体与观察方向。动作自然度、全角度画面、性能和正式托管环境仍需验收，不能直接视为上线完成。

以下为此前切片结果，旧控制描述和计数不代表当前版本。

- 测试工具切片最终验证：233/233 规则通过；首轮全量浏览器 43/46 通过，发现旧测试的驾驶方向、足音长用例超时、扫描读取时序问题。修正并补充停车绕行后，受影响 4/4 浏览器专项通过。套件现在 47 项，尚需修订后单次完整回归与人工发布验收，不把部分复测合并成全量通过。详情见 docs/HTML5_VERIFICATION.md。

- 2026-09-08 测试工具：新增 9 个独立玩法测试组、自动发现的完整回归、独立日志/失败截图/trace/HTML 报告及被测文件指纹。单项、纯规则、全量自动化与人工发布验收明确分开；不自动部署。新 runner 的闪避单项实际通过，工具规则 5 项通过；完整操作见 docs/GAMEPLAY_TESTING.md。

- DASH-ENTRY-20260908：新增调查解锁的入门矢量闪避，R/WASD、4 m、0.35 s、6 s 冷却与体力成本相连；分段碰撞、不刷徒步、菜单和存档不重置冷却。三维喷流/轨迹/材质尘粒与 HUD/U 接通。217 项逻辑、6 项专项浏览器通过。范围、限制和手测见 docs/DASH_ENTRY_IMPLEMENTATION.md；尚无完整五境界/战斗，不计 M0—M2 全部完成。

- SCAN-VFX-20260908：D2实施开始，M0初步审计见 docs/M0_3D_AUDIT.md。替换跟随人物且循环跳变的Q扫描圈为固定发射点的三维波面；统一生命周期，删除旧圈驱动。202项逻辑、1项浏览器专项通过。未完成M0/M1全项，五境界与战斗仍未实现。

- 2026-09-08 文档交付：建立 D2 开发总纲、技能成长规格、3D/特效/工程规范、里程碑与验收四份文档。统一五境界、有效熟练度、条件突破与有限配装；列明 M0—M6 依赖、代码替换清理与旧档迁移。README 已切换新入口，旧方案标为历史。此次只更新文档，未实现新能力、未修改发布版本或存档。

- 2026-09-08 设计提案（未实现）：`docs/EVOLUTION_DESIGN_V1.md`，共同续航底座＋踏星/破相/归藏三路线，有限专精点、主动/被动/核心槽、调查催化材料与试炼、初始战斗数值、四类场景解法、存档与阶段验收。附两张生成概念图；未改动现有游戏规则，未把战斗系统计作完成。

- **MAP-R3-20260907**：Tab 拆为独立地图，删除档案页签、装饰文案和页脚；J 记录、U 进化使用不同顶层界面，保留 HUD/暂停菜单点击入口。地点列表默认折叠；标点反馈固定在地图下方，不遮挡按钮。保留现有玩法和存档。

- 2026-09-07：追加探索与 R2 浏览器回归 **8/8 通过**。补齐地图尺度收纳/追踪例外/恢复任务/日志返回地图测试，并将 R2 专项加入默认端到端测试命令。本轮为验证与防回退测试，不改运行时或存档；用户手测入口见验收台账。

- **EXPLORATION-R2-20260906**：车辆方向与鼠标环视解耦；键盘油门、转弯、倒车、刹车使用独立车辆状态和分段碰撞检测。Tab 默认地图，J 独立日志快捷入口，地表图按尺度收纳舰内终端。坠舰翼片改封闭实体，修正悬空上层结构、发动机支座和入口上梁，并同步入口上梁的镜头碰撞。
- 本修订沿用下面的 C-MOTION 全身动作及现有存档，不重置调查进度。逻辑回归 200/200；浏览器与截图复验结果见 `docs/HTML5_VERIFICATION.md`。

- 当前版本 **C-MOTION-20260906**：前两轮纯程序化步态的自然度均被用户退回。本轮使用 Quaternius UAL1 免费 Standard 的 CC0 全身动作，转换为离线关键帧，重定向到 C 服装统一 19 骨骼蒙皮。保留织物、非对称矿壳、S 形脊线，不替换成素材包默认人偶。
- 第三人称身体平滑转向行进方向，镜头保持独立；S / A / D 是转向后方 / 左侧 / 右侧赶路，不冒充免费包没有的倒走和横跨步素材。第一人称、交互、碰撞和物理速度不变。
- 动画先驱动全身 FK，再做有限贴地 IK；移除旧 `ARM_BEATS`、方向脚路径模板、三骨躯干＋独立硬肢体的并行驱动。起停、转身和待机混合到完整姿态；动作不移动地面或第一视角眼高。
- C 慢走 1.65 m/s、常速 4.7 m/s、仅前向 / 前斜向 Shift 冲刺 8.6 m/s；飞行、车辆、30/60/90/120 秒成长和 4.5 m 限高均保留。脚步继续按实际接触材质合成，空中 / 驾驶无步声，落地一次，暂停不补播。
- 测试与画面记录见 `docs/HTML5_VERIFICATION.md` 当前切片；旧 197 + 41 的四方向曲线版计数为历史结果，不能当成本轮或自然度验收。新的实际连续预览：`docs/ui-implementation/human-locomotion-preview.html`，可以暂停、慢放及换角度。
- 本轮最终验证：197/197 Node、21/21 浏览器（14.2 分钟，3 模型＋7 动作整合＋11 主流程），最终离线包 SHA-256 `b0da25568669b160020790a8eff8afe397371f7bde2c073bd0c2b95f56671c63`。产物语法和差异空白检查通过；不把旧回归数量重复计入。
- 试玩：刷新后核对主菜单版本号 → 继续原档 → V → C 慢走 → W / S / A / D → C 常速 → W + Shift；观察屈膝回收、身体前倾、屈肘摆臂、转身和停步，接着测 Tab、起飞 / 着陆及驾驶。仍需用户确认动作自然程度，不声称已达到动捕或高精度美术。

- 上轮已补齐第二章现场操作：石碑 / 逃生舱由按 E 即完成改为三路可见相位调谐，滑块与 ±15° 微调让合成相位归零；地下回声源需要三路反相至 180° 后明确确认。错误或未提交不推进，终端暂停移动和资源，Esc / Tab 取消返回探索并恢复视角控制。
- 上轮已接通有限远野闭环：断环观测架（-1100,650）→ 返回信标封存 → 埋沙镜阵（1200,650）→ 返回封存 → 倾斜石柱（1250,-1100）→ 最后封存与独立远野终记。每站需要实地调谐，不提前公开后续地图点，不增加空壳采矿、制造或重复货币奖励；三个实体装置共用可见几何、碰撞和岩石净空。
- 兼容保留 `story.chapterVersion: 2`、既有两章完成标记和共生进化；新增 `survey.version: 1` 保存按序归档记录及一份待封存样本。旧两章完成档刷新继续即可进入第一处远野，不要求新开或重做已完成校准；未提交调谐位置不存档。
- 调查流程复验：未完成第二章的存档测试 E 打开→错误相位不能确认→三路对齐→确认；Esc / Tab 取消后直接观察。两章完成档测试三次“现场采样→回信标 E 封存”，中途刷新保留样本，最终重读远野终记。最终自动化及浏览器结果统一记录在 `docs/HTML5_VERIFICATION.md`，不沿用下方历史数量。
- 当前仍未完成：多星球与飞船航行、完整制造及交通工具生产、高精度服装 / 场景美术、更多环境事件和后续调查内容。现有 HTML 仍是两章加有限远野调查的可玩纵切；旧 Godot 系统不视作已同步的浏览器功能。
- C「玄壳共生服」造型继续修正：修长人体、灰褐织物、薄片式非对称矿壳与 S 形琥珀脊线，收敛此前圆鼓护甲的机器人感；实际正背面 / 游戏画面已检视，仍是程序化三维模型，不宣称达到高精度概念图质量，最终美术认可待用户验收。
- U「共生进化」续航调整：身体冲刺与装备助推统一为 30→60→90→120 秒，初始 30 秒、每级 +30 秒。身体按真实地面徒步与调查里程碑逐级适应；装备依供电及异常研究、在信标或已供电终端旁校准。条件逐项显示，需手动确认，不自动升级。
- 时长由 `endurance.mjs` 单一规则驱动实际消耗与界面；容量仍为 100，基础每秒消耗 100/30，满级 100/120。旧成长存档保留等级与体力/能量百分比，不因本次数值调整补满资源。
- 地图容量复核：真实地表仍为 6000×6000 m，人物、助推和载具共用边界。按现有速度，满级单次冲刺理论约 1032 m、助推约 1440 m；出生点至最近边界约 2810 m，现有空间足够，本轮不扩充空旷外围。
- 升级不补满体力/能量，不改变速度、恢复或重新按键门槛，满级仍限高 4.5 m、舰内禁飞。驾驶、飞行、顶墙与暂停不刷身体里程；身体确认前需在地面站稳 3 秒，打开档案不计休息。
- 成长等级和实际徒步里程存档；没有成长数据的旧档保留调查成果，但不推算此前行走距离、不赠送成长等级。上一切片新增 23 项成长规则/动态续航逻辑、1 项 U 输入、4 项成长浏览器场景和 1 项真实角色检视；本次数值调整的最终结果记录在 `docs/HTML5_VERIFICATION.md`。
- 修正短飞衔接：空中保留真实 Shift 按键边缘，不再误清仍有效的低体力冲刺；耗尽后不能借飞行重新授权，松键与恢复门槛照常生效。
- 上轮 30 秒起步与每级 +30 秒调整：120/120 Node；当时最终构建的成长 / 移动专项 8/8、真实键盘冲刺 1/1、连续两章调查 1/1 通过；新时长界面和窄屏截图已检视。该数量不代表本轮调谐与远野功能的验证结果。
- 上轮 C 造型与成长切片验证：118/118 Node；完整浏览器 25/25；最后短飞衔接修正后重新构建，成长 / 移动专项 8/8。该数量仅代表旧续航版本；当时角色、成长页及 640/768/900px 布局截图已检查，详细时序保留在 `docs/HTML5_VERIFICATION.md` 历史切片。
- 新增巡迹勘探车：发现→回收耦合芯→安装修复→24/32 m/s 驾驶→刹车安全下车。T 快捷追踪，地图保存实际停车点；驾驶恢复身体体力但不恢复车载电池，旧存档兼容。
- 陨石地表：聚簇中/大实体碎片、贴地冲击痕与铁质裂纹，共享可见几何及碰撞，保留调查主路和修车场地。新版角色与载具使用合批三维几何，没有新增贴图假场景。
- 上轮交通切片验证：94/94 逻辑测试；完整浏览器回归 20/20（含两章连续实地调查）；最终交互修正后专项 4/4。该结果不代表本轮成长逻辑或 C 造型已通过验收；详见 `docs/HTML5_VERIFICATION.md`。

- 探索地图：空白标点、已知地点追踪、拖拽/缩放、玩家居中、解锁舰内细图；导航方向距离与存档连接。
- 实体感与视角：石块共用可见足迹和碰撞，小碎砾材质足音，大岩块需绕行；V 切换带避障追随镜头和实体宇航员的第三人称。
- 第二阶段：黑匣子返回后继续现场校准石碑/逃生舱、定位地下回声源、隔离返流、最终回信标封存。旧通关存档接续第二阶段。

- 体力重设计：删除一直按 Shift 也自动恢复/再次冲刺的循环。当前初始满值可跑 30 秒，松开后延迟 1.5 秒恢复，至少 25% 并重新按键才可再跑；成长只改变持续时长，不取消该约束。

- 控制衔接修复：Tab 返回探索自动恢复鼠标捕获；长按去重、快速开关异步保护、日志返回来源、系统组合键保留与失败降级。回归记录见 `docs/HTML5_VERIFICATION.md`。

- 重建为真实第一人称 Three.js 场景：6 km 地表、可接近/进入的 320 m 残骸，摄像机不跟随步态摇动地面。
- 连续两阶段调查线：残骸黑匣子回收 → 地表实测相位与地下回声隔离；两处异常在第一阶段可选，第二阶段需要重新测量。
- 删除旧 HTML 塔防/血清/航线运行模块与对应过期测试，项目外留有恢复备份；Godot 工作区未改动。
- 本轮规格与测试步骤：`docs/HTML5_PROTOTYPE.md`、`docs/HTML5_VERIFICATION.md`。以下为 Godot 及早期版本历史进度。

---

## 📊 当前进度总览

| Phase | 目标 | 状态 | 文件数 |
|-------|------|------|--------|
| **Sprint 0** | 核心原型 | ✅ 完成 | 44 |
| Sprint 1 | 建造 + 科技树 | ⬜ 待开始 | - |
| Sprint 2 | 随机地图 | ⬜ 待开始 | - |
| Sprint 3 | 发布 Steam | ⬜ 待开始 | - |

---

## ✅ 已完成系统

| 系统 | 详情 |
|------|------|
| 🎮 角色控制 | WASD + Shift，宇航员低模 |
| 💨 O₂ 系统 | 氧气条 + 消耗 + 死亡/重生 |
| 👾 敌人 AI | 外星虫子朝基地冲，波次递增 |
| 🔫 炮台 | 自动索敌 + 科幻炮塔 |
| 🔫 **玩家武器** | 5 种（手枪/霰弹枪/步枪/火焰/冰冻），鼠标瞄准射击 |
| ⭐ **品质系统** | 5 级（普通→精良→稀有→史诗→传说），伤害倍率 1.0→2.5x |
| 🪨 **资源采集** | 铁/虚空晶/生物质/能量核心/蓝图，每天刷新 |
| ⚒️ **锻造台** | E 键打开，升级品质/解锁武器，材料配方 |
| 🌙 昼夜循环 | 2 分白天 / 1 分夜晚 |
| ✨ 特效 | 枪火、爆炸、漂浮孢子 |
| 🎨 美术 | 低模 CSG，宇航员/虫子/炮塔/逃生舱 |

---

## 💰 费用

| 轮次 | 内容 | 花费 |
|------|------|------|
| Sprint 0 | 项目搭建 + 角色 + O₂ | $0.58 |
| Sprint 0.5 | 敌人 + 炮台 + 昼夜 | $0.64 |
| Sprint 0.6 | 视觉美化 | ~$1.50 |
| Sprint 1 | 武器 + 资源 + 锻造台 | ~$2.00 |
| **合计** | | **~$4.72** |

---

## 🖥️ 你在 Windows 上试玩

```powershell
# 1. 装 Godot 4.6.2 标准版
#    https://godotengine.org/download/windows/

# 2. 克隆项目
git clone https://github.com/qnctx/star-abyss-game.git
cd star-abyss-game/src

# 3. 打开项目
#    用 Godot 打开 project.godot

# 4. 按 F5 试玩
#    WASD 移动, Shift 冲刺
#    白天探索，夜晚敌人来袭
#    炮台自动防守
```

---

## 📸 预期画面

```
俯视视角，紫色毒气笼罩的外星地表
你 = 白色宇航员
基地 = 倾斜的逃生舱（橙色灯光闪烁）
炮台 = 金属科幻炮塔（枪口发光）
敌人 = 红眼六足虫子（从四面八方冲来）
弹丸 = 黄色能量弹（旋转拖尾）
夜晚 = 一波波虫子越来越多
```
---

## 2026-06-25 - TEST_ISSUES Review Fix Slice

- Reviewed the former `docs/TEST_ISSUES.md` (now merged into `docs/REVIEW.md`) and agreed with the severe issue priority, with one adjustment:
  - `spawn_resources()` should not become a daily auto-refresh because WorldGenerator already owns the world resource layout.
- Fixed the immediate severe defects:
  - Ice projectiles now call `Enemy.apply_slow(source_id, multiplier)` with a stable source id.
  - `InventoryManager.consume_resources()` is now atomic and returns `false` without changing inventory when resources are short.
  - Serum inventory labels no longer duplicate Chinese resource labels.
  - Oxygen UI guards against `max_oxygen <= 0`.
  - Restart now routes through `GameManager.reset_game()` and clears enemies, built structures, inventory, tech unlocks, death drops, signal logs, base state, and wave state.
- Stopped the day loop from calling the legacy resource top-up helper, fixed that helper's property check, and moved GameManager enemy/resource scenes to `preload`.
- Cleaned the unused player debug frame counter and the mixed-language stuck comment.
- Added automated inventory coverage for failed consumption and updated manual restart test steps.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

Results:

- `test_runner.gd`: 372 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- `git diff --check`: passed; Windows LF-to-CRLF warnings only.
- Godot still prints known RID/ObjectDB cleanup warnings on headless exit.

---

## 2026-06-09 - Crosshair Aim Tooling Slice

- Reworked first-person aiming and tool targeting around a shared center-screen crosshair:
  - Mouse look now supports yaw and pitch instead of only left/right yaw.
  - CombatHUD draws a small center crosshair.
  - `AimTargeting` provides shared center-ray helpers for terrain hits and aimed group targets.
- Unified core tool actions around the crosshair:
  - Weapons fire along the crosshair direction.
  - Build preview follows the crosshair terrain hit and becomes invalid when aiming into the sky.
  - Harvester can collect visible resources by crosshair or dig revealed buried resources.
  - Repair/upgrade/recycle actions prioritize crosshair-targeted structures.
- Followed up on screenshot playtest issues:
  - Ordinary `1-5` always switch tools; build type selection moved to `Tab` / `Shift+1-7`.
  - Selecting Harvester/Scanner/Weapon/Repair exits build mode so `2` can immediately harvest.
  - Build preview stays outside the player's collision, hides when aiming into sky, and shows a readable building label.
  - Revealed buried resources now use a larger ground marker, vertical beam, icon, and bigger `DIG` label.
  - Harvester aim radius/range is more forgiving for visible resources and buried markers.
- Kept terrain collision disabled and uses `WorldGenerator.get_height_at()` for terrain aiming so the earlier invisible-wall fix stays intact.
- Added automated coverage for camera pitch, crosshair HUD, crosshair build target, sky invalid placement, tool switching out of build mode, build preview labels, buried beams, and aimed Harvester collection.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

- `test_runner.gd`: 369 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- `git diff --check`: passed; Windows LF-to-CRLF warnings only.
- `codegraph status`: up to date; current GDScript index remains 0 files / 0 nodes.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

----

## 2026-06-09 - Build Ground Cursor Fix

- Fixed build placement interaction after playtest feedback that the preview felt stuck on a flat plane and could not be made green:
  - Build mode now uses a ground cursor controlled by mouse movement.
  - Mouse left/right moves the preview sideways.
  - Mouse up/down moves the preview nearer/farther.
  - The preview still snaps to `WorldGenerator` terrain height after movement.
- Clarified HUD/manual-test wording:
  - `LMB NEED RES` means the location may be valid, but Inventory is missing the listed cost.
  - Green requires both a valid location and enough resources.
- Added automated coverage that vertical mouse motion changes the build target and that the snapped preview height matches terrain height.

Validation:

- `test_runner.gd`: 337 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- `git diff --check`: passed; Windows LF-to-CRLF warnings only.
- `codegraph status`: up to date; current GDScript index remains 0 files / 0 nodes.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

----

## 2026-06-09 - Resource Visual Readability Slice

- Reworked visible resource models from single primitive blocks into distinct procedural silhouettes:
  - `iron`: orange ore chunks on a dark rock base.
  - `void_crystal`: purple crystal cluster.
  - `biomass`: green spore/pod cluster.
  - `energy_core`: cyan glowing core with dark shell pieces.
  - `blueprint`: flat gold data chip with cyan trace lines.
- Revealed buried resources now show a small resource-shaped icon above the dig marker, not only a flat circle.
- Added automated coverage for visual signatures, multi-part resource visuals, and buried-resource reveal icons.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

- `test_runner.gd`: 348 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- `git diff --check`: passed; Windows LF-to-CRLF warnings only.
- `codegraph status`: up to date; current GDScript index remains 0 files / 0 nodes.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

----

## 2026-06-09 - Visible BP Data Chip Slice

- Added visible `blueprint` data chip pickups near the crash basin:
  - World generation now places 5 fixed early BP chips on terrain.
  - BP pickup amount is fixed at `1`.
- BP chips now use a taller gold beacon so the player can spot them during first-pass testing.
- Expanded `ResourceScanner` scan types with `blueprint` / `BP`.
- Added automated coverage for world BP placement and scanner BP targeting.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

- `test_runner.gd`: 351 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed; world generation logs `placed 5 blueprint resources`.
- `git diff --check`: passed; Windows LF-to-CRLF warnings only.
- `codegraph status`: up to date; current GDScript index remains 0 files / 0 nodes.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

----

## 2026-06-09 - Toolbelt Buried Resource Slice

- Added a connected toolbelt loop:
  - `1` Weapon, `2` Harvester, `3` Scanner, `4` Build, `5` Repair.
  - Weapon firing is gated to the Weapon tool so scanning/harvesting/building does not also shoot.
  - Build tool opens Build mode; later crosshair tooling moved building selection to `Tab` / `Shift+1-7` so `1-5` always remain tool slots.
- Added buried resource gameplay:
  - `WorldGenerator` places hidden buried iron, biomass, crystal, and core deposits on terrain.
  - Scanner resource modes now prioritize buried deposits, reveal them, and show depth/distance/direction.
  - Harvester digs revealed buried deposits over multiple left-clicks and grants resources to Inventory.
- Expanded CombatHUD:
  - Bottom toolbelt row shows current tool and action/status text.
  - Inventory and scanner rows remain visible for resource count and signal feedback.
- Added automated coverage for main scene ToolbeltManager wiring, HUD toolbelt text, buried world placement, scanner reveal, and harvester inventory reward.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
git diff --check
codegraph status
```

Results:

- `test_runner.gd`: 335 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- `git diff --check`: passed; Windows LF-to-CRLF warnings only.
- `codegraph status`: up to date; current GDScript index remains 0 files / 0 nodes.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

----

## 2026-06-09 - Ground Resource And Inventory HUD Slice

- Responded to playtest feedback that collected iron/crystal counts were not visible and some pickups/debris appeared airborne.
- Added a visible `CombatHUD` inventory summary:
  - Always shows `IRON`, `CRYSTAL`, `BIO`, `ENERGY`, `CORE`, `BP`, and `O2 KIT` counts.
  - Shows zero counts so the player does not need to infer inventory from Objective missing-resource text.
- Improved early resource pickup reliability:
  - Resource Area3D nodes now stay fixed near terrain height; only the mesh/label does a small visual bob.
  - Pickup collision radius is larger so ground-level walking collects resources without needing to jump.
  - World-generated resources now spawn within `0.04` units of terrain height.
  - Decorative debris is grounded so it does not read as floating loot.
- Fixed Death Drop cleanup:
  - Drop nodes are now `queue_free()`d instead of immediately `free()`d, avoiding the Godot locked-object error when collection happens during a collision signal.
- Clarified current design:
  - Resources are generated once with the world and do not randomly respawn after pickup yet.
  - `G` Scanner remains a navigation tool for finding the nearest target type; inventory counts are shown by CombatHUD.
- Added automated coverage for ground resource placement, ResourceHUD/CombatHUD inventory text, and safe Death Drop node cleanup.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
git diff --check
codegraph status
```

Results:

- `test_runner.gd`: 320 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- `git diff --check`: passed; Windows LF-to-CRLF warnings only.
- `codegraph status`: up to date; current GDScript index remains 0 files / 0 nodes.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Resource Readability Labels Slice

- Improved resource readability after playtest feedback that iron and O2 sources were hard to distinguish.
- Resource pickups now show billboard labels above the node:
  - `IRON`
  - `BIO`
  - `CRYSTAL`
  - `CORE`
  - `BP`
- O2 Plants now show an `O2` billboard label.
- Resource pickup shapes/colors were made larger and more distinct while keeping the existing walk-over auto-pickup behavior.
- Added automated coverage that resource nodes and O2 Plants create readable labels.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
git diff --check
codegraph status
```

Results:

- `test_runner.gd`: 313 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- `git diff --check`: passed; Windows LF-to-CRLF warnings only.
- `codegraph status`: up to date; current GDScript index remains 0 files / 0 nodes.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Low Oxygen Objective Guidance Slice

- Expanded `ObjectiveTracker` with an urgent low-oxygen branch:
  - At or below 25% O2, the objective now guides the player to the strongest available survival action.
  - If an O2 Kit is carried, it shows `Objective: Use O2 Kit (Q) | O2 XX%`.
  - If no kit is carried but craft resources are available, it shows `Objective: Craft O2 Kit (H) | O2 XX%`.
  - Otherwise it shows `Objective: Find O2 Plant or return to base | O2 XX%`.
- Low-oxygen guidance sits after extraction holdout/completion and before ordinary night/build/repair guidance.
- Player lookup now ignores invalid/dead nodes and chooses the valid player with the lowest O2 ratio, which keeps tests and future multi-node scenes deterministic.
- Added automated coverage for all three low-O2 objective outcomes.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
git diff --check
codegraph status
```

Results:

- `test_runner.gd`: 311 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- `git diff --check`: passed; Windows LF-to-CRLF warnings only.
- `codegraph status`: up to date; current GDScript index remains 0 files / 0 nodes.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Scanner O2 Plant Tracking Slice

- Expanded `ResourceScanner` scan targets:
  - Added `oxygen_plant` as the fifth `G` cycle mode.
  - Resource modes still scan `resource_nodes`.
  - O2 Plant mode scans the `oxygen_plants` group.
  - HUD displays `Scanner: O2 plant Xm DIR | G type`.
- Added automated coverage for scanning a nearby O2 Plant while preserving existing resource scan behavior.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 307 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.

---

## 2026-06-09 - Oxygen Plant Exploration Slice

- Added `OxygenPlant`, a one-use wilderness O2 refill:
  - Restores `45` O2 when the player is below max oxygen.
  - Does not consume itself when the player is already full on O2.
  - Displays a small glowing cyan/green plant with a pickup collision area.
- Expanded `WorldGenerator`:
  - Places 14 O2 Plants across the terrain away from the immediate crash-pod center.
- Added automated coverage for:
  - World generation placing O2 Plants.
  - O2 Plant script loading and group membership.
  - Refill amount, full-O2 no-consume behavior, and pickup deletion state.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 306 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.

---

## 2026-06-09 - Oxygen Canister Exploration Slice

- Added `OxygenCanisterManager` autoload:
  - `H` crafts one O2 Kit from `2 biomass + 1 energy`.
  - `Q` consumes one O2 Kit to restore `60` O2, capped at max O2.
  - Refuses to consume when the player is already full on oxygen.
- Expanded inventory:
  - Added `oxygen_canister` as a regular inventory resource.
  - Save/load persists O2 Kits automatically through `InventoryManager`.
  - Death Drop can include O2 Kits because they are part of the carried resource dictionary.
- Expanded Combat HUD:
  - Shows `O2 Kit: N | Q use +60 O2 | H craft READY/NEED ...`.
- Added automated coverage for crafting, resource cost, oxygen restoration, full-O2 no-consume behavior, and HUD text.
- Fixed a test isolation issue by freeing the temporary O2 Kit test player synchronously so Resource Scanner tests do not pick the wrong `player` group node.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 296 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.

---

## 2026-06-09 - Death Drop Recovery Slice

- Added recoverable death resource drops:
  - `DeathDropManager` autoload removes about half of carried resources on player death.
  - A single active `DeathDrop` crate spawns at the death position.
  - If the player dies again before recovery, the old payload merges into the new drop instead of leaving multiple confusing packs.
  - Walking into the crate restores the dropped payload through `InventoryManager`.
- Integrated with player death:
  - `player.gd` now records a death drop before emitting `player_died` and starting the normal respawn delay.
- Expanded Combat HUD and Objective Tracker:
  - HUD shows a `Drop:` distance/direction hint only while a death drop is active.
  - Objective Tracker guides recovery after urgent defense/base/structure repair states.
- Expanded SaveManager:
  - Active death drop payload and position are saved/restored with `F6/F7`.
- Added automated coverage for drop creation, inventory loss/restoration, HUD hint, objective priority, direct manager save/load, and SaveManager persistence.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 281 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.

---

## 2026-06-09 - Extraction Holdout Slice

- Added an Extraction Holdout finale state to `SignalLogManager`:
  - Unlocking the `signal_100` Radio Log in normal play starts a timed extraction holdout.
  - Completing Signal during daytime forces an immediate night attack through `GameManager.force_start_night()`.
  - The holdout counts down and then marks extraction as complete/victory.
  - Holdout active/complete state and remaining time are captured by save/load.
- Expanded Combat HUD:
  - Signal HUD can now show `Extraction: hold mm:ss | defend base`.
  - Completed holdout shows `Extraction: rescue shuttle landed | victory`.
- Expanded Objective Tracker:
  - Extraction holdout takes priority over normal build/repair/cache objectives.
  - Active enemies are surfaced as `Defend extraction zone | Enemies N | mm:ss`.
- Updated SaveManager sync so restored Signal Beacon progress can rebuild milestones without spawning a new wave during load.
- Added automated coverage for extraction start, countdown completion, HUD text, objective priority, and save/load persistence.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 257 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.

---

## 2026-06-09 - Signal Cache Exploration Slice

- Added `SignalCache`, a collectible radio-led exploration reward:
  - Spawned by `SignalLogManager` when signal milestones unlock.
  - Each milestone has a deterministic cache position and resource bundle.
  - Player collision collects the cache and grants resources.
  - Collected caches are recorded so they do not respawn after save/load.
- Expanded `SignalLogManager`:
  - Tracks `collected_caches`.
  - Spawns uncollected caches for unlocked radio logs.
  - Provides nearest active cache direction/distance via `get_cache_hint()`.
- Expanded Combat HUD:
  - Latest Radio log row now also shows nearest Signal Cache hint while a cache is active.
- Expanded Objective Tracker:
  - During safe daytime states, active Signal Caches are surfaced as `Locate signal cache` objectives.
- Added automated coverage for cache spawning, collection rewards, collected-state tracking, HUD cache hints, and objective cache guidance.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 247 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- CodeGraph status: `[OK] Index is up to date`; current GDScript project still indexes 0 files.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Signal Radio Log Slice

- Added `SignalLogManager` as a new autoload:
  - Tracks unlocked signal radio logs.
  - Unlocks logs at `25`, `50`, `75`, and `100` Signal Beacon progress.
  - Stores the latest visible radio message.
- Signal Beacon now registers progress with `SignalLogManager` whenever energy advances the signal.
- Combat HUD now shows the latest Radio log under the signal/save rows.
- SaveManager now persists:
  - Signal radio log unlock state.
  - Latest radio message.
  - It can also rebuild missing log milestones from restored Signal Beacon progress for older save data.
- Added automated coverage for log milestones, latest message, save/restore, Signal Beacon-triggered unlocks, and HUD Radio display.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 237 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- CodeGraph status: `[OK] Index is up to date`; current GDScript project still indexes 0 files.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Signal Beacon Slice

- Added `SignalBeacon`, a buildable long-term rescue-signal structure:
  - Build mode key: `7`.
  - Cost: `30 iron + 10 void_crystal + 10 energy + 2 blueprint`.
  - Every `6s`, consumes `1 energy` and adds `10/100` signal progress.
  - Pauses when energy is unavailable.
  - Shows completion text at `100/100`.
- Expanded `BuildManager` and `TechManager`:
  - Signal Beacon is unlocked by default after the research/blueprint economy exists.
  - Build HUD now includes `7Sig`.
- Expanded Combat HUD:
  - Shows the strongest Signal Beacon status as a dedicated `Signal:` row.
- Expanded Objective Tracker:
  - After the current defense/upgrade chain, it guides the player to build and power the Signal Beacon.
- Expanded SaveManager:
  - Saves and restores Signal Beacon progress and power timer.
- Added automated coverage for build option/cost, energy consumption, progress pause/completion, HUD status, default tech unlock, and save/load restoration.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 223 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- CodeGraph status: `[OK] Index is up to date`; current GDScript project still indexes 0 files.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Save HUD Feedback Slice

- Connected `SaveManager.save_status_changed(message)` into the Combat HUD.
- Added a short-lived top-left save status row:
  - `Save: Saved`
  - `Save: Loaded`
  - failure/no-file messages such as `Save: No save file`
- The status clears automatically after `2.5` seconds so it does not crowd the combat/objective HUD.
- Added automated coverage for showing and clearing the HUD save status.
- Updated GDD, context docs, progress, and the manual save/load checklist.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 202 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- CodeGraph status: `[OK] Index is up to date`; current GDScript project still indexes 0 files.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Save Active Enemies Slice

- Expanded SaveManager beyond the first save/load MVP:
  - Active enemies are now included in save data.
  - Persisted enemy data includes position, scale, name, health, speed, damage, attack settings, and wave variant metadata.
  - Loading restores enemy nodes from `enemy.tscn`.
  - Restored enemies reconnect to `GameManager._on_enemy_died` and `_on_base_reached`.
  - `GameManager.enemies_alive` is restored from the number of active enemies loaded.
- Updated manual save/load test steps to cover saving during night while enemies are alive.
- Updated GDD and context docs to remove the previous active-enemy persistence limitation.
- Added automated coverage for enemy capture, restore, enemy count, health, and variant label.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 199 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- CodeGraph status: `[OK] Index is up to date`; current GDScript project still indexes 0 files.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Save Load MVP Slice

- Added `SaveManager` autoload with runtime quick-save/load:
  - `F6` quick-save.
  - `F7` quick-load.
  - Save file path: `user://star_abyss_save.json`.
- MVP persisted state:
  - Inventory resources.
  - Tech unlocks.
  - Base HP, shield, wave number, phase timer, day/night flag, wave direction.
  - Built structures with build id, position, scale, build cost/label, HP, max HP, upgrade level, turret damage/fire rate.
- BuildManager now tags newly placed structures with `build_id` metadata so save/load can restore the right structure type.
- Combat HUD main hint now includes `F6 Save F7 Load`.
- Load behavior:
  - Clears current enemies and built structures before restoring saved state.
  - Active enemies are not persisted yet; this MVP is safest during daytime or between waves.
- Added automated coverage for save capture and apply/restore across inventory, tech, base state, and built turret state.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 193 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- CodeGraph status: `[OK] Index is up to date`; current GDScript project still indexes 0 files.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Structure Damage Guidance Slice

- Added damaged-structure visibility to the Combat HUD:
  - Base HUD row now shows a compact damaged-structure summary.
  - Single damaged structure example: `Struct Turret 40/100 | B+R READY`.
  - Multiple damaged structures show count plus worst HP.
  - Repair readiness uses the existing `5 iron + 2 biomass` repair cost.
- Objective Tracker now prioritizes damaged structure repair during daytime after base repair:
  - If funded, it asks the player to repair damaged structures with `B, R`.
  - If unfunded, it asks for the missing repair resources.
- Added automated coverage for HUD damaged-structure text and objective repair priority/resource guidance.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 174 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- CodeGraph status: `[OK] Index is up to date`; current GDScript project still indexes 0 files.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Enemy Structure Targeting Slice

- Expanded enemy behavior beyond only walking to the base:
  - Enemies now scan for nearby `built_structures`.
  - If a structure is within `structure_target_range`, the enemy moves to it.
  - Inside `attack_range`, the enemy stops and attacks on `structure_attack_interval`.
- Structure attacks use the existing structure HP metadata:
  - `structure_health`
  - `structure_max_health`
  - Structures at 0 HP are queued for deletion.
- This makes defensive placement, repair, and accidental walling more meaningful:
  - Structures can buy time.
  - Enemies no longer just press against nearby built modules forever.
  - Repair mode can recover damaged structures after attacks.
- Added automated coverage for target selection, attack cooldown, repeated structure damage, structure destruction, and ignoring non-built nodes.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 168 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- CodeGraph status: `[OK] Index is up to date`; current GDScript project still indexes 0 files.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Tech Unlock Gate Slice

- Added `TechManager` as a small blueprint-driven technology autoload.
- Default unlocked buildings:
  - Turret.
  - O2 Station.
  - Solar Panel.
  - Research Station.
- Default locked buildings:
  - Shield Generator: unlock costs `1 blueprint`.
  - Slow Field: unlock costs `2 blueprint`.
- Build mode now supports `Y` / `unlock_tech`:
  - Locked selected buildings cannot be placed.
  - Valid locked placement previews show a purple locked state.
  - HUD shows unlock cost plus `Y READY` or `Y NEED BLUEPRINT`.
- Objective Tracker now guides the player from Research Station into Shield Generator unlock/build, then Slow Field unlock/build, then turret upgrades.
- Added automated coverage for tech autoload loading, default unlock state, blueprint costs, failed unlocks, successful unlocks, and build-manager unlock status.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src -s res://test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 160 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- CodeGraph status: `[OK] Index is up to date`; current GDScript project still indexes 0 files.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-08 - Headless Test Runner Repair

- Fixed `src/test_runner.gd` so it can run with Godot 4.6.2 `--script` by inheriting `SceneTree`.
- Reworked the system test runner to resolve autoloads through `/root` instead of compile-time singleton identifiers.
- Updated the turret test to match the current `fire_projectile()` API.
- Fixed `src/test_standalone.gd` to run as a `SceneTree` script with consistent space indentation.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
```

Results:

- `test_runner.gd`: 33 passed, 0 failed.
- `test_standalone.gd`: 29 passed, 0 failed.
- Godot 4.6.2 still prints RID/resource cleanup warnings after the generated headless scene exits, but both commands return exit code 0.

---

## 2026-06-08 - Player Movement Feel Fix

- Added continuous terrain following so walking downhill visibly follows the slope instead of feeling flat.
- Added grounded stick force and landing recovery so the player can move again after jumping.
- Added crouch/prone camera height changes so stance changes are visible.
- Added walking/sprinting camera bob and sprint FOV feedback so `Shift + W` feels faster.
- Applied zone speed bonuses to player movement speed.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Manual test steps:

- Walk forward on uneven terrain and verify the camera height follows downhill/uphill terrain.
- Press Space once, wait for landing, then confirm WASD movement still works.
- Hold Ctrl to crouch and Z to go prone; the camera should lower and movement should slow.
- Hold Shift + W; speed should increase, bob amplitude should increase, and FOV should widen slightly.

Follow-up:

- Fixed Shift modifier input blocking movement by reading WASD/arrow keys and Shift/Ctrl/Z through physical-key fallbacks in `player.gd`.
- Manual check: hold Shift first, then press W; press W first, then hold Shift. In both orders, forward movement should continue and sprint feedback should activate.

Invisible wall follow-up:

- Disabled the generated terrain mesh collision layer/mask because player grounding now uses `WorldGenerator.get_height_at()` directly.
- Added player stuck recovery: if movement input is held but horizontal displacement stays near zero for a short time, the player is nudged backward and snapped back to terrain height.
- Manual check: walk across rocky/uneven slopes and around zone entrances; if you hit a bad collision edge, movement should recover instead of freezing.

---

## 2026-06-08 - Build Defense MVP Slice

- Added `BuildManager` to `main.tscn`.
- Added `B` build mode for placing turrets with a green/red placement preview.
- Turret placement costs `20 iron + 5 void_crystal`, consumes resources through `InventoryManager`, and uses the existing turret scene.
- Added placement validation for resource affordability, range from player, base clearance, and turret spacing.
- Added `CombatHUD` showing base HP, day/night phase, wave number, enemies alive, and build hint/cost.
- Added `GameManager` signals for base HP and enemies alive.
- Added enemy kill rewards directly into the resource loop.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 38 passed, 0 failed.
- Main scene short startup: passed.

Manual test steps:

- Collect at least `20 iron` and `5 void_crystal`.
- Press `B`; verify the turret preview appears and changes color for valid/invalid placement.
- Left-click valid ground to place a turret; verify resources decrease and the turret remains active.
- Press right mouse or Esc to leave build mode.
- During night waves, verify the Combat HUD updates enemies alive and base HP.
- Kill enemies; verify resources increase from enemy rewards.

Build preview follow-up:

- Changed turret preview placement from a mouse `Y=0` plane hit to a player-forward terrain sample.
- Preview now sits at terrain height instead of floating above a flat placement plane.
- Preview colors now mean: green = placeable, yellow = valid position but missing resources, red = invalid position.

---

## 2026-06-09 - Prototype Cleanup Slice

- Removed obsolete placeholder/test scripts: `hello_test.gd`, `test_project.gd`, `system_test.gd`.
- Removed unused prototype scripts: `terrain_detail.gd`, `teleport_beacon.gd`, `forge_trigger.gd`.
- Removed duplicate UI scenes no longer instanced by `main.tscn`: `oxygen_ui.tscn`, `serum_ui.tscn`.
- Removed unused material resources now generated in code: `ground_material.tres`, `rock_material.tres`, `crystal_material.tres`.
- Archived historical sprint task/spec docs under `docs/archive/`.
- Removed unused `world_generator.gd` ExtResource from `main.tscn`; `WorldGenerator` remains an autoload.
- Updated `src/CONTEXT.md` to reflect current direct-HUD setup.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

---

## 2026-06-09 - O2 Supply Station Build Slice

- Added `O2Station`, a buildable oxygen refill structure inspired by the GDD O2 supply station / exploration tether design.
- Expanded `BuildManager` from single turret placement to multi-structure placement:
  - `1` selects Turret.
  - `2` selects O2 Station.
- O2 Station costs `15 iron + 10 biomass`.
- O2 Station refills player oxygen over time inside a short radius.
- Build preview keeps the same placement rules and terrain snapping as turret placement.
- Combat HUD now shows the selected building, selected cost, and build controls.
- Updated system test coverage for `o2_station.gd`.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 39 passed, 0 failed.
- `test_standalone.gd`: 29 passed, 0 failed.
- Main scene short startup: passed.

Manual test steps:

- Press `B`, press `2`, and verify the HUD says `O2 Station`.
- Collect `15 iron + 10 biomass`.
- Place an O2 Station on valid terrain.
- Walk away, let oxygen drain, return near the station, and verify oxygen refills.
- Press `1` to switch back to turret placement.

---

## 2026-06-09 - Base Repair And Wave Test Slice

- Added base repair as a connected survival-defense loop:
  - Base repair costs `10 iron + 5 biomass`.
  - Repair restores `25` Base HP.
  - Repair is only allowed when the base is damaged, so full-health repairs do not consume resources.
- Added `BaseInteraction` to `main.tscn`:
  - Press `E` near the base pod to repair.
  - Press `N` during day to immediately start night for manual wave testing.
- Hardened the day/night cycle with a cycle token so a skipped day timer cannot later start a duplicate night.
- Combat HUD now shows base repair and quick-night test hints.
- Added automated coverage for base repair behavior and the new main scene node.
- Added `docs/TEST_PLAN.md` as the single manual checklist for tonight's playtest.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

- `test_runner.gd`: 50 passed, 0 failed.
- `test_standalone.gd`: 29 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but all validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Turret Upgrade Slice

- Added turret upgrade support to `BuildManager`.
- Build mode now supports:
  - `U` upgrades the nearest turret under the preview.
- Turret upgrade costs `10 iron + 5 energy + 1 blueprint`.
- Max turret upgrade level is `3`.
- Each upgrade increases turret damage and fire rate.
- Upgraded turrets scale up slightly so the change has an in-world visual cue.
- Added `upgrade_structure` input action.
- Added automated coverage for upgrade cost, stat increase, level metadata, and max-level rejection.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

- `test_runner.gd`: 101 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but all validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Enemy Reward Rule Slice

- Fixed enemy reward semantics:
  - Combat kills still grant rewards.
  - Enemies that breach the base now call `die(false)` and do not grant kill rewards.
- Enemy `enemy_died` signal now carries `should_reward`.
- `GameManager.spawn_enemy()` binds the spawned enemy into `_on_enemy_died()` so reward logic can read `wave_variant` metadata.
- Added variant bonus rewards:
  - Scout: `+1 biomass`
  - Tank: `+2 iron`
  - Elite: `+1 void_crystal + 1 blueprint`
  - Boss: `+1 energy_core + 1 blueprint`
- Added automated coverage for boss variant bonus and no-reward base breach deaths.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 141 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Objective Tracker Slice

- Added `ObjectiveTracker`, a lightweight next-step guidance node.
- Objective priority currently covers:
  - Night defense.
  - Base repair when Base HP is damaged.
  - First Turret.
  - O2 Station.
  - Solar Panel.
  - Research Station.
  - Slow Field.
  - Turret upgrade.
  - General scan/expand fallback.
- Combat HUD now displays the objective line below the resource scanner hint.
- Main scene now includes an `ObjectiveTracker` node.
- Added automated coverage for script loading, main-scene wiring, and missing-resource text formatting.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 134 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Structure Repair Slice

- Added structure HP metadata for newly placed buildings:
  - `structure_health`
  - `structure_max_health`
- Added build-mode structure repair:
  - Press `R` near a damaged built structure under the preview.
  - Repair costs `5 iron + 2 biomass`.
  - Repair restores `35` structure HP up to max.
- Added connected damage source:
  - Enemy `base_reached` now sends a hit position.
  - `GameManager` damages nearby built structures when base breach damage gets through shield.
  - Shield absorption prevents structure splash damage when it absorbs the whole hit.
- Combat HUD now includes `R Repair` and shows damaged structure HP/readiness when aimed at a repair target.
- Added automated coverage for repair HUD status, repair resource cost, full-health rejection, and base-breach splash damage.
- Updated input map, GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 128 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Building Status HUD Slice

- Expanded `BuildManager` status APIs:
  - `get_recycle_status_text()` shows targeted structure label and expected refund.
  - `get_upgrade_status_text()` shows nearest turret level plus `READY`, `NEED RES`, or `MAX`.
  - `get_structure_label()` and `get_refund_text()` centralize HUD-facing status formatting.
- Combat HUD build hints now use two rows while build mode is open:
  - Row 1: build/recycle controls.
  - Row 2: selected building cost/placement readiness plus upgrade target status, or recycle target/refund status.
- Added automated coverage for recycle target/refund text and upgrade level/status text.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 116 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Enemy Wave Variant Slice

- Expanded night waves with visible enemy variants:
  - `Scout`: every 3rd wave unless replaced by elite/boss priority; smaller cyan enemy, faster and weaker.
  - `Tank`: every 4th wave unless replaced by scout/elite/boss priority; larger gold enemy, slower and tougher.
  - `Elite`: every 5th wave except boss waves; purple stronger enemy.
  - `Boss`: every 10th wave; red high-threat enemy.
- Combat HUD now shows the current wave variant label beside the wave number.
- Spawned enemies now store `wave_variant` and `wave_variant_label` metadata for future reward/UI hooks.
- Added variant tinting on enemy CSG primitive visuals.
- Added automated coverage for wave priority, labels, spawned metadata, and tinted visual assignment.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

Results:

- `test_runner.gd`: 111 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Building Recycle Slice

- Added recycle mode to `BuildManager`.
- Build mode controls now include:
  - `X` toggles recycle mode.
  - Left click recycles the nearest built structure under the preview.
- New placed structures now store `build_cost` and `build_label` metadata.
- Recycled structures refund `50%` of original material cost, minimum `1` per cost item.
- Recycle mode preview turns blue when a target can be recycled.
- Combat HUD shows recycle-mode instructions.
- Added `recycle_mode` input action.
- Added automated coverage for recycle refund and non-built node rejection.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

- `test_runner.gd`: 92 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but all validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Wave Warning HUD Slice

- Added phase countdown state to `GameManager`.
- Combat HUD now shows:
  - `Next night mm:ss` during day.
  - `Night ends mm:ss` during night.
  - Last wave approach direction.
- `GameManager` records the rough compass direction of the first spawned enemy in each wave.
- Added `wave_direction_changed(direction)` signal.
- Moved Combat HUD rows down to avoid overlap after adding the third status line.
- Added automated coverage for countdown text and direction labeling.
- Updated GDD, context docs, progress, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

- `test_runner.gd`: 86 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but all validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Slow Field Defense Slice

- Added reusable slow support to `Enemy`:
  - `apply_slow(source_id, multiplier)`
  - `remove_slow(source_id)`
  - `get_effective_speed()`
- Added `SlowField`, a buildable control defense.
- Expanded `BuildManager`:
  - `6` selects Slow Field.
  - Slow Field costs `15 iron + 8 biomass + 4 energy`.
- Slow Field reduces enemy movement speed to `45%` inside its radius.
- Enemies recover normal speed after leaving the field or when the field is removed.
- Combat HUD build hint now includes `6 Slow`.
- Added automated coverage for slow application and removal.
- Updated GDD, context docs, and manual test plan.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

- `test_runner.gd`: 82 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but all validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Resource Scanner Slice

- Added `ResourceScanner`, matching the GDD P0 scanner priority.
- Resource nodes now join the `resource_nodes` group when ready.
- Main scene now has a `ResourceScanner` node.
- Combat HUD now shows nearest scanned resource distance and rough direction.
- `G` cycles scanner target type:
  - iron
  - biomass
  - void_crystal
  - energy_core
- Added automated coverage for scanner loading, main-scene wiring, and resource-type filtering.
- Updated `docs/GAME_DESIGN_DOC.md`, `src/CONTEXT.md`, and `docs/TEST_PLAN.md`.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

- `test_runner.gd`: 77 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but all validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - GDD MVP Execution Update And Research Station Slice

- Added a current MVP execution section to `docs/GAME_DESIGN_DOC.md`:
  - Current implemented systems.
  - Current MVP design target.
  - Near-term development order.
  - Manual test/documentation rule.
- Added `ResearchStation`, the first concrete technology-tree entry point.
- Expanded `BuildManager`:
  - `5` selects Research Station.
  - Research Station costs `20 iron + 5 void_crystal + 5 energy`.
- Research Stations consume `5 energy` every `20` seconds to produce `1 blueprint`.
- Research pauses automatically when energy is below `5`.
- Added automated coverage for research energy consumption and blueprint output.
- Updated `docs/TEST_PLAN.md` with Research Station manual test steps.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

- `test_runner.gd`: 71 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but all validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Solar Panel Energy Slice

- Added `energy` as a base power resource in `InventoryManager`.
- Updated Resource HUD labels/colors so generated `energy` is visible.
- Added `SolarPanel`, a Tier 1 base module aligned with the GDD solar-panel direction.
- Expanded `BuildManager`:
  - `4` selects Solar Panel.
  - Solar Panel costs `18 iron + 6 biomass`.
- Solar Panels generate `1 energy` every `5` seconds during daytime.
- Solar Panels stop generating during night, connecting power production to the day/night loop.
- Added automated coverage for the `energy` resource and solar panel generation behavior.
- Updated `docs/TEST_PLAN.md` with Solar Panel manual test steps.

Validation:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

- `test_runner.gd`: 65 passed, 0 failed.
- `test_standalone.gd`: 31 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but all validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

---

## 2026-06-09 - Base Shield Generator Slice

- Added `ShieldGenerator`, a buildable base defense module from the GDD shield-generator direction.
- Expanded `BuildManager`:
  - `3` selects Shield Generator.
  - Shield Generator costs `25 iron + 8 void_crystal + 1 energy_core`.
- Shield Generators add `50` max shield to the base when built.
- Base shield absorbs enemy base damage before Base HP is reduced.
- Shield slowly recharges while shield capacity exists.
- Combat HUD now shows `Shield current/max`.
- Added automated coverage for shield registration and damage absorption.
- Updated `docs/TEST_PLAN.md` with shield generator manual test steps.

Validation plan:

```cmd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_runner.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --script test_standalone.gd
"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe" --headless --path src --quit-after 2
```

- `test_runner.gd`: 58 passed, 0 failed.
- `test_standalone.gd`: 29 passed, 0 failed.
- Main scene short startup: passed.
- Godot 4.6.2 still prints RID/resource cleanup warnings on headless exit, but all validation commands returned exit code 0.

Manual test steps are consolidated in `docs/TEST_PLAN.md`.

- DEV-D1-R1已交付冻结并核验全部文件哈希；开发证据只读检查通过。全新独立TEST-D1-R1（01a09529-f3ac-7493-9254-0b338b933119）已运行，实际验证战斗、同档救援、采集/掉落、满包回滚、存放拾取、刷新及窄屏布局；尚未通过验收或集成D1。

- TEST-D1-R1独立验收FAIL：实机21/23、独立Node8/9。墙角追击振荡阻断验收，另有空尸/耗尽草提示错误。报告及66文件证据已核验归档，已派原DEV修R2；D1仍未集成，新版本须另建独立复测。

- D1-R2已冻结并核验105文件与R1保留证据；新独立TEST-D1-R2（01a0954e-85dc-7523-a9fa-bb8bfbcb15ee）已运行，复验墙角/耗尽提示及关键旧闭环。尚未验收通过或集成。

- D1-R2已独立PASS并集成独立场景入口：实机30/30，主目录Node30/30；墙角振荡/空源提示关闭，202文件证据归档且回归后哈希一致。未接原main，加工D2/同宠E未实现。

- 用户纠偏（2026-09-12，覆盖此前独立白盒产品路线）：唯一产品基线恢复图一原游戏playable/star-abyss.html，4173入口，约6×6公里原地图/角色/载具/星空/调查/旧存档保留。白盒95文件移入artifacts/retired-d1-whitebox/20260912，运行目录d3-scene及对应test已移走，4182无监听；A/B/C/I规则及历史验收档案保留。原main/game.js/资产未更改，主4173 HTTP200。
- 已新建并确认运行三个分会话：DEV-ORIGINAL-CORE 原游戏玩法接入 01a095eb-c6dc-7bd2-a512-3889505e68a5（a6f0）；DEV-ORIGINAL-WORLD 大地图遭遇与场景 01a095eb-c6de-7f91-a4d9-3d02f79dbd72（93ad）；DEV-ORIGINAL-UI 原游戏HUD与背包 01a095eb-c6e4-7140-baca-8c8870ba29bc（7d07）。接口直接互通并抄总控，所有权/实施合同见ORIGINAL_GAME_REBASE.md。187文件当前原游戏快照ORIGINAL-BASE-R1供隔离开发，禁止从旧Git HEAD误还原。交付分别新建独立TEST，最后再做唯一原入口整合实机测试，通过前不覆盖主bundle。

- 原游戏接入发现存档坐标硬限制，已派I-R3扩展并要求新独立TEST；CORE/WORLD/UI继续并行，未绕过根事务。新增按键R/H/I保留原F与空格。

- I-R3开发完成已核验冻结47文件（39自有+7依赖+版本清单），version-r3 SHA256 ce42b6d0363105791b0a3a3cae9060221f749b6a7ec8ae7ae4cb51cf1cc742bd；26份R2基线与主依赖/旧证据完整。新独立TEST-I-R3任务01a095f8-627f-73c0-805c-dc0e5c2c57a4（5a02工作区）已运行，验证大世界固定配置贯穿、边界与错配/篡改拒绝、真实IDB原子保存救援和R2回归。主目录仍I-R2，独立通过前不升级。

- ORIGINAL-UI-R1完成开发冻结：总控核验26文件，versionSHA a8f4ab39bb5ef27407756816731c3026095e8bc86163ecdac5c07441634ac714，186原基线文件及主CSS基线一致，查看390最终背包图。新TEST-ORIGINAL-UI-R1任务01a095fa-f3ec-7be0-b62d-dc0d08382faa（1325）运行中，独立验证多宽度/原UI快捷键/长列表/持续update焦点/destroy/请求事件。开发3/3、四宽40按钮命中只是开发证据，未计独立通过。产品只有index.mjs与CSS，fixture/预览不能入真实main；CORE已获冻结源用于未验收开发接线。真实战斗/存档/菜单暂停须最终CORE整合另测。

- I-R3独立PASS并已集成：独立Node9/9、真实IDB12/12、R2真实IDB7/7，真实刷新后整根一致；总控核验报告SHA 44f9031a5f19147d9a98dcea228bb0ccdecdbc0a0d24db39b013523e66cf9ee1及75证据条目、47被测副本哈希。升级前核对主I-R2原SHA，5文件更新/15新增/21保留/7依赖仅校验，旧文件备份总控artifacts/integration-backups/I-R2-before-R3。76证据文件归档，清单INTEGRATED-I-R3.json及TEST-I-R3-EVIDENCE.json。主Node15/15，通过preload仅重定向新测试JSON输出，测试后全部集成文件/证据SHA一致。CORE可按清单接入I-R3继续同原存档实机；此PASS仅同根存储，不代表原大地图/载具/战斗整合完成。

- TEST-ORIGINAL-UI-R1独立FAIL：开发Node3/3、独立Node3/5；短列表四宽40命中通过不代表长内容通过。P2 D1未知null/空字符串投影0/0且缺items误称空库存；P2 D2 390长列表挡原T、附近提示覆盖原HUD；P2 D3仅仓库label更新重建按钮丢焦点。总控核验报告SHA2525a86e36d2858ddee49e8bcb4dcb544c1fb7762b0c0cf9293b24993a23a644、58报告/证据条目及26被测文件，主归档58证据文件及TEST-ORIGINAL-UI-R1-EVIDENCE.json。退原UI开发R2，新冻结后必须新建TEST-ORIGINAL-UI-R2，主UI未集成。B1真实Shift+Tab被原input抢焦点列CORE联合门槛：菜单打开停用原input/暂停战斗、正确恢复，不能用合成DOM反向循环代替实机。CORE可继续其他开发但UI-R1不作为通过依赖。

- UI-R2已新建独立复验，CORE实际击杀掉落开发链继续；未完成原游戏整合验收。

- WORLD-R2已冻结核验并新建独立场景测试；UI-R2亦在独立复验，原游戏联合交付未完成。

- UI-R2独立复验退回R3；WORLD-R2原地图实走独立验收中，CORE继续真实返营地/容量恢复链。原游戏整合尚未完成。

WORLD-R2独立测试进行中发现动态足底缺陷：windup相对地形-0.1442至+0.1034m，其他运动状态最高约+0.0842m；已通知WORLD开发准备R3，保持R2冻结，TEST继续四点实走和三角射线证据。CORE临时R2联调不得视为最终验收。CORE另自报真实敌人96→63后玩家死亡/救援/刷新同instance仍63，包矿10血4仓2保留；21至24证据待最终独立复验。

UI-R3控制冻结已核验45文件及186原基线、R1/R2双方完整快照。versionSHA bf3d932c8a3f0b858e39e4e193a7b33a0940747b3008c456e93812d8dd717739；全新独立TEST-ORIGINAL-UI-R3任务01a09629-a01b-7043-aefc-4b158a111d88（28db）已派发，验证失效按钮焦点/pending/四宽布局及旧回归。CORE已获本版index/CSS要求真实营地最后份存取与Shift+Tab联合实操。开发12Node/24DOM自报通过不计验收，主目录未集成UI。

CORE开发实操补齐容量恢复：营地存1释放后按原路线回camp自然刷新generation1矿，拾本代2血后33.5kg，H采1矿成功至35.5kg、包矿10→11、源3→2；再H超限拒绝源仍2。证据25/26待最终独立CORE复验，须区分自然刷新新代和旧源耗尽。现返营地进行UI-R3真实pending/末项/Shift+Tab联测；WORLD-R2仅临时依赖待R3。

WORLD-R3开发第一版动态足底修复：仅躯干蓄力倾斜，按实际顶点计算支撑脚接地，行走摆腿保留抬脚；腿段连接倾斜髋部，尸体贴地及死亡恢复切换。开发8测试通过自报，未冻结未验收；需实际画面检查并结合TEST-R2完整报告，新冻结后另开独立R3测试。R2冻结保持。

UI-R3真实CORE联合开发实操：原营地6血逐份存/取至双方末行移除12次，实际IDB pending后焦点均enabled关闭按钮；原生Shift+Tab/Return及末项移除后关闭正常，回CANVAS后原自动步行约7.5m；I开包2秒位置/HP/simTime不变。证据27-ui-r3-native-focus及28完整root/截图；包矿11血6/仓矿2守恒。非独立验收，已告知独立UI-R3任务保持fixture与CORE边界，最终仍待独立结论和WORLD-R3。

WORLD-R2独立追加W-R2-02：死亡整尸最低真实顶点离原渲染地形8.30至16.10cm（4地点×5yaw，camp yaw0 15.419cm），证据corpse-measurements.json/corpse.tap；主控已要求R3对实际渲染三角地形验证死亡首帧/稳定/恢复。TEST本版已到北侧(1218,-1071)，继续最后北到西约2.9km原自动步行，完整报告未交付。

WORLD-R3开发补充W-R2-02证据triangle-measurements.json：原PlaneGeometry索引三角Raycaster，4点×5yaw死亡/恢复各180帧抽样整敌mesh顶点，开发自报整体最低点误差1e-5m内；动态脚重放独立R2参数，不依赖contact标记。开发10组测试通过，原UI步行营地近景后以明确视觉pose selector观察idle/windup/chase，无业务结算，不计真实战斗/死亡验收。等待R2完整报告再冻结并新独立测试。

CORE开发补测UI-R3满载营地取回失败：35.5kg原生Shift+Tab/Return取矿遭holderOverloaded，焦点仍enabled关闭按钮，32-before/33-rejected完整root字串一致。只读调试观察节点key补pending/error/save后33错误view一致，业务未改；31旧根证据有效但错误显示须看DOM，报告注明替代关系。独立整体验收未完成；要求最终交付列明187基线5处差异路径/原因/SHA。

UI-R3全新独立TEST通过（限UI修复），73条证据与45冻结文件主控核验，报告SHA 5159d9892d65b4d9980a67df54cb69aaddb7a4a887924f59aa69a38d72430f06，报告及证据已归档主目录。四种原生延时焦点失效/新增取出停仓pending/稳定节点与滚动/四宽布局及原菜单通过；768导航间隔12px、192采样命中。B1原生Shift+Tab仍FAIL于fixture原输入，是CORE控制门联合边界，不能扩大UI PASS为真实事务/战斗/驾驶验收。CORE可锁UI-R3依赖，待WORLD-R3和最终新独立CORE验收；主bundle未重建。

WORLD-R2完整独立TEST结束FAIL：W01蓄力穿地、W02整尸悬空。主控核验55证据/26冻结文件并归档，报告SHA ab0246a5e1478eb2d3a711a1bf142cf1e4c9d80a315908bfc497f335fd34c8ed。四遭遇点原输入同版实走完成，原修车/登乘/视角/下车通过，持续驾驶及真实CORE业务未测；Node14项12通过2明确失败。已令WORLD开发据完整报告逐项核对并正式冻结R3，另纠正R2材料文档9与实际8差异。新R3仍需全新独立TEST，未主目录整合。

WORLD-R3正式控制冻结核验19文件/187基线/两份R2快照，versionSHA eb2fc0a93cf481ead76e4778d7fc7135feba8d6dd13cc415b621c82aae721547。全新独立TEST-ORIGINAL-WORLD-R3任务01a09643-1fcd-7581-b25f-802b16f638df（4c37）已派发；复验W01/W02、多点真实三角地形、动态脚/整尸转换/LOD及原入口实操。旧R2四点实走只能历史引用，本轮路径按实际记录，不冒称重走。CORE暂不升级，待本次独立结论后一次最终联调统一冻结。

WORLD-R3新独立TEST通过限定显示/静态查询，主控核验45证据/19受测文件，报告SHA bd666703f113866e549cadda992f35c071465f1eecd87aa828e49cc4cc2b4e1e并归档。开发11回归+独立11通过；W01/W02实际渲染三角多点/朝向/运动与死亡恢复、LOD修复通过。本版仅营地原输入实走，四点几何覆盖不冒称四点重走；倒地快慢非此次美术判定，真实CORE业务/AI/驾驶未测。已正式放行CORE按控制冻结升级WORLD-R3，做一次最终真实联调后统一冻结，届时另开全新CORE独立验收。主目录bundle未重建。

2026-09-13 CORE-R1控制冻结核验80文件，versionSHA 7c71f1c06861cf198c09aaea7f2ba3704a83e7c0c77a4edbe515fbaf5911d449。全新独立TEST-ORIGINAL-CORE-R1任务01a0965b-bfc9-7951-84ad-4051077fa1d1（9d51）已派发，锁UI/WORLD/I R3，验证原游戏真实战斗/有限采集/仓库容量/救援读档/输入门及原设施兼容，开发自测不算验收。连续负重移速/体力倍率未接，要求测试核对承诺范围并准确列缺项；持续驾驶仍未测。主目录bundle未重建，完整游戏尚未独立通过。

CORE-R1独立TEST进展：187/47/45/19/80冻结SHA核验，独立tree恰5基线差异；自有4297原V/拖动/自动步行/T/F回收芯修车上下车及刷新实操，H源3→0包3、重复与reload不复制。新增独立runtime边界5项通过（同步门重入/米制坐标/并发CAS拒绝/超重恢复/救援收据补偿），旧7/41仅回归；仓库战斗救援仍继续。负重连续移速/体力倍率未消费，属设计未完项，最终范围须明确不得称全部设计完成；持续驾驶未测。

CORE-R1独立早报阻断：WORLD查询返回冻结对象，main约110行赋dynamicBlocked在非严格IIFE静默失败/严格ESM抛TypeError，最终runtime动态车阻挡未接通。独立dynamic-adapter测试FAIL，attached=false/frozen=true/extensible=false，证据9d51本轮目录。已退CORE准备R2，在CORE组合适配保留WORLD不可变契约；R1冻结不改，待完整FAIL报告再最终冻结新测试。独立仓库3份逐存空/逐取空、末项焦点、ShiftTab/Tab/Return返回CANVAS及开包pose/HP/simTime暂停实机通过；战斗救援继续。

CORE-R2草稿动态适配修复：新增CORE queries组合对象，保留WORLD冻结查询，实时车辆getter参与占位/整段扫掠/有高度LOS，main传组合对象。开发9项通过（严格工厂/静态墙/跨车扫掠/高空射线/移车更新及真实A/I内存runtime），非浏览器驾驶证据。4212严格原入口烟测进行；R1冻结不改，待完整独立FAIL报告逐项核对后正式R2及新独立测试。

CORE-R1独立追加真实原车消费者证据：createMobility原车(72,80)检测阻挡true，WORLD静态占位true，丢失dynamicBlocked后runtime生成/通行均误判可通行；严格TypeError独立记录。已要求CORE-R2纳入真实原车对照。独立死亡/救援/reload已两轮，19/21/22根分段对比敌伤包仓耗尽载具和中断cast通过，仍补击杀掉落，最终R1结论FAIL尚待完整报告。

CORE-R1完整独立FAIL报告已核验69证据，报告SHA f951eaf9585c54104223eefc3e23933075b0aed9e04c343343520a5abee89860并归档。B1动态载具阻挡未接通为阻断；有限采集/逐存取焦点暂停/两轮救援保留敌伤/最终击杀掉落不复制实玩通过。08/14/15/16截断无效，完整19/21/22及24至27替代。浏览器容量超限闭环、持续驾驶、远点/原全任务/实际AI绕障碍仍未测，负重倍率设计未完。已授权CORE逐项核对完整报告后正式R2冻结，随后另开新独立TEST重点修复和容量实操，主bundle未改。

CORE-R2控制冻结核验31文件及双方R1快照80文件，versionSHA 3db9a28e10bafd674fbda11436e40411ab0ac646dc6f0c59babc3298e502d2f4。全新独立TEST-ORIGINAL-CORE-R2任务01a0967b-8c30-7040-8008-7c7a220178b7（1f9b）已派发，重点动态车查询实际消费者/严格入口/车遮挡，以及浏览器超限拒绝-返营地腾空间-恢复采集闭环，关键控制/读档/战斗回归。设计负重连续倍率与持续驾驶未完成边界照留，开发冻结等待独立结果，主目录bundle未改。

CORE-R2独立复测进度：五冻结329文件SHA通过，4298严格预览实际查询串servedSHA 84a45490a8e799f1491fe9b80a9538bb9637764f10514eff070a3154e110bd49一致。新增6组车辆边界通过，含main严格构造/真实clear-spawn/原车/半径扫掠/乘车动态替换/顶高射线/缺接口存档前拒绝/原静态查询。实机原输入绕岩至(82,92)，敌96→63后玩家死亡救援营地，完整根20k分段可解析；同档reload、容量与击杀继续，整体尚未PASS。

CORE-R2独立进展：几何6+真实runtime内存消费者3组共9通过；消费者验证原WORLD anchor占车拒生成/移车恢复、隔车无伤/移车63HP、暖路径不穿车，明确非实驾。浏览器同敌63→0唯一掉落2并拾尽，三矿矿9血2，原修车上下车、营地逐存取末项焦点/关闭回CANVAS完成，根审计6通过。等待自然代际冷却补浏览器容量超限恢复，不改时钟；实际隔车攻追和持续驾驶尚未测，整体未结案。

2026-09-13：CORE-R2独立已测范围PASS，报告SHA 5f0fae33021b63e302806afe2202ed5b7af1f3e345a7c77a14a8bff003890f65；80清单证据核验，281目录文件归档。主目录正式集成CORE8+UI2+WORLD3产品及原入口bundle共14文件，旧main/CSS/game.js备份于控制artifacts/integration-backups/original-before-core-r2，I-R3保持已集成状态，无关脏改动保留。game.js为独立实测严格bundle原字节，served SHA84a45490a8e799f1491fe9b80a9538bb9637764f10514eff070a3154e110bd49。正式4173原入口原生开始/V/I/关闭回画布及原角色星空月面烟测通过。独立自然代际/容量拒绝-存放-同源恢复-再拒绝/满包取仓拒绝、救援掉落读档通过；实际隔车交战/持续驾驶仍未测，负重连续移速体力倍率未接，不宣称全部设计完成。试玩说明docs/development/ORIGINAL_GAME_PLAYTEST.md。

2026-09-13 美术流程用户明确要求并长期遵循：所有新建/重做3D资产先生成概念参考图，再按图建模→原游戏接入→独立视觉与动作验收，不能把几何原型算最终美术。已写主AGENTS.md。裂甲掠兽concept.png位于docs/art/creatures/rift-prowler-v1，用户批准本批20积分，已提交Lux3D cn G1图生3D task3444708目标100000面ZIP+GLB；只恢复该ID不重复收费，未授权未来额外批次。DEV-CREATURE-ART任务01a09b13-4065-7871-b3f3-08cbd1e2019a（ab11）负责原任务下载/Blender制作交付，WORLD原任务先准备只读GLB动画接入契约。当前原游戏4173保持运行，正式模型尚未完成/接入。

裂甲掠兽ART-V1已主控核验38条SHA+清单39文件，控制冻结CREATURE-ART-V1，GLB SHA39c6cc6ddafd84f9d269026618dec68f69eb6038bbd7810245a3376f22caf879。已看实际三分之四GLB截图，进入接入开发非最终美术验收。35967三角/20骨/1材质/2张2K/9MB，无clips；四足蒙皮由WORLD程序IK。WORLD93ad获授权模型/动画/加载接入，COREa6f0负责main等待/失败/重试防不可见敌战斗，主4173和原冻结保持不动。待交付后新独立原游戏视觉/动态/加载生命周期验收。用户先出图再3D规则仍适用。

WORLD-CREATURE-R1已主控核验47冻结文件，versionSHA55a15c19d049ff71849d2a187eccab593217d4ab15741c6e8030ab1ae3405301；主控查看最终contact-idle/灯开/dead截图，原肩灯偏白与尸体姿态仍需独立美术审阅，不凭数字代替观感。已新建TEST-WORLD-CREATURE-R1独立美术/蒙皮地形/阴影/加载生命周期测试。CORE获八产品授权在独立4214联调真实模型加载/网络失败重试，主4173保持未替换。

TEST-WORLD-CREATURE-R1（01a09b3f-d92c-7be2-af0e-9aa7e4ab4928，fe4f）独立早报异常rig缺陷：真实GLB仅破坏Chest骨名，无初始view仍ready，校验推迟首次update。正常冻结GLB未损坏。已退WORLD准备R2加载阶段结构验证/failed staging清理，R1冻结不改，独立继续原画面动作与完整报告。CORE可继续正常模型联调但最终依赖须等修复版独立放行，主4173未替换。

WORLD-CREATURE-R1独立追加失败staging残留：Chest无view假ready且update抛后仍ready；LF_Upper缺失failed但首anchor残visual，retry出现双visual，I03/I03b最小证据已交WORLD合并R2修复。要求先全部验证再挂场景，异常释放全部staging，重试每anchor恰一实例。测试自有4231有无法解释位移/血量/viewport变化段，已排除有效证据并要求核对独立页避免争抢用户控制。正常冻结GLB不变，主入口不动。

WORLD-CREATURE-R1独立正常模型尸体视觉FAIL：原生4232稳定dead及多角度显示站姿横倒、伸腿托高躯干，最低LF足接触0但多数躯干高悬；corpse-extra.json P10 .391m/中位.778m为辅助说明非任意判定阈值。已退WORLD在R2调整收腿/自然肩胸髋支撑和死亡恢复过渡，原全蒙皮三角地形校验继续，不能仅最低点通过。灯开灰白仍可辨甲片只记录边界。加载骨架/staging修复与尸体美术均待新冻结新独立验收，主试玩未替换。

WORLD-CREATURE-R1完整独立FAIL报告已核验，SHA03e20d00799c8a9c47ee36d7459783c2e2463dc168e20ede12bc540029c27df4；259清单证据和manifest已按清单归档（测试依赖符号链接不复制）。F1骨架缺失假ready/F2失败残留重影/F3伸腿托高尸体；已授权WORLD继续R2三项修复、完成针对复核后正式冻结，新独立测试随后。主试玩未替换。

WORLD-CREATURE-R2控制冻结核验31文件及双方R1不变，versionSHA7dc36442a60761f23dc34573451c2d82c2d320a4d91a89051be8c2d5e9aa91f9。新独立TEST-WORLD-CREATURE-R2任务01a09b5d-045e-7b41-8302-12dbcc2332ae（9663）已启动，复验F1/F2骨架加载事务及F3自然收腿侧卧，含抬脚阴影和原三角蒙皮地形。主控已看反向低视角R2尸体图，可进入独立审阅非最终通过；CORE授权九产品定向实际联调，最终等待独立结果。主4173未替换怪物。

TEST-WORLD-CREATURE-R2进展：冻结31SHA一致，F1缺Chest/F2缺LF_Upper复测修复，开发20仅回归。新增loader注入boneInverse有限可逆但不匹配绑定姿态仍ready，实际变形量与契约/默认SHA路径可达性待确认。主控要求区分异常注入防御和正常资产，不直接扩大为生产阻断；WORLD只读评估是否有限补修，当前冻结不改，F3原生倒地及既定复验继续。

WORLD-CREATURE-R2独立完整报告已核验归档279清单文件，报告SHAf59f2f82f5a9fb66ccb315f260aa509030332f57b1726d7bcb4928a9b22403d9。旧F1/F2/F3已在报告限定范围通过；仅P2 B14公开注入loader有限逆绑定一致性缺口FAIL，默认SHA正常生产不扩大为损坏。WORLD获准据完整报告正式完成R3有限补修及冻结，待新独立复测；主试玩不动。

WORLD-CREATURE-R3控制核验20文件，唯一validation产品变化，其余八产品和双方R2冻结完整不变，versionSHA516363e9b557c8d4e894956737f5fd0cd22ab6e80f25aecb4af209cdd986811a。全新独立TEST-WORLD-CREATURE-R3任务01a09b6d-7342-74e2-8b5b-0ed78a4df4cc（186b）已启动，针对B14 rest-bind一致性/失败清理retry和正常原入口烟测；R2未变美术动画限定结果可继承不冒称新全实操。CORE先核验，独立通过后新冻结最终依赖并联合验收，主试玩尚未替换。

WORLD-CREATURE-R3独立限定PASS已核验归档231清单文件，报告SHA49aa8adbd41a82c00a4ff44f4ea57cc1fdb65c67d06f522d515e9acdd4cf9811。独立11/加载14/动画9通过，B14无view失败/零残留/不修输入/正常retry通过，原入口GLB四实例烟测正常；F3全地形美术继承R2未变限定基线，不扩大CORE业务通过。正式放行CORE更新R3依赖，必要定向回归后新CORE-CREATURE-R2冻结并联合独立验收。主4173未替换。

CORE-CREATURE-R2控制核验32文件/九CORE产品及双方R1不变，versionSHA890ff143162baa07177b957cb9e819013f3f3095f24b84aa8316a1bf46c4b3e0，锁WORLD-CREATURE-R3独立限定PASS。新联合TEST-CORE-CREATURE-R2任务01a09b79-aaf7-7691-99b4-d11a8dab15ba（f812）已启动，独立验证加载/故障retry/快捷键门/迟到结果/原游戏真实击杀拾取读档与自然尸体。旧容量长路基线不无故重跑，已知未测边界保留，主4173未替换。

## 2026-09-14 正式怪物接入完成

先概念图，再Lux3D生成、Blender整理与20骨绑定的裂隙兽已替换原几何占位怪物。CORE-CREATURE-R2 + WORLD-CREATURE-R3独立联合限定PASS，298项清单文件核验归档；仅安装10个变化产品文件，保留原6×6km月面、角色、载具和存档。准确受测bundle及GLB已在4173 HTTP复核。回滚备份与安装SHA见 versions/INTEGRATED-CREATURE-R2.json，独立范围见 reports/TEST-CORE-CREATURE-R2.md。

试玩步骤：http://127.0.0.1:4173/ 刷新后继续，WASD移动、V换视角、R近身攻击、H拾取、I背包、Esc暂停。加载失败可重试或返回菜单；不要清除旧存档。关机后双击项目根启动试玩.cmd恢复服务。实测击杀、侧卧倒地、拾1、刷新同档包1/余1不变，加载延迟/503/菜单取消和并发门通过。未宣称完整驾驶、旧故事、全远点或全平台验收；肩灯照射偏灰白、四尸首次姿态计算峰值仍为既有边界。后续所有新/重做3D仍按AGENTS.md先图后模型执行，本轮不是所有游戏资产已重制。

## 2026-09-16 第一阶段候选（待独立原生完成）

用户要求先出地图图再对应3D并改进怪物灵活性，且并行分工。已完成概念图/基色图、8组岩岭3坑7簇岩壁、共享地形/三角碰撞和AI响应改进。候选PHASE1-R3共141文件，bundle55e4e6ba08f26cb2a3e6e16ec7cfd69a592d9616fded8dc3a5d868d5347f9ba2；尚未替换正式4173 bundle。原生独立任务01a0a9eb-c8c1-77b1-9939-67f73eeddbbb正在7587实走第一章，已取黑匣子返程。主控100项定向+37项载具/支撑补回归；独立几何修复6469点/107原相机漏点、AI独立5组通过。试玩步骤 PHASE1_PLAY_GUIDE.md；详细实现报告 PHASE1-MAP-IMPLEMENTATION.md、TEST-PHASE1-CAMERA-FIX.md。源编辑已在主工作区，正式bundle必须等独立结论再调用主控artifacts/publish-phase1.cjs且提供已核验report SHA。


## 2026-09-16 R4 发布与星球总控接管

PHASE1-R4 已精确发布至原 4173 入口，HTTP 核验 HTML、bundle、玄武岩贴图及怪物 GLB 与磁盘一致。bundle SHA256：19b29a055653cbe0b8732cd73f9eadfa21c2654c01894f95d038f52f6f64737d。独立报告 reports/TEST-PHASE1-R4.md，SHA256：9965af9ad86d36aa1b2d266dfd3ad6f2fa1d32ad67e020ffa9fb872044557067；25 证据与141 冻结文件已核验归档。R4 只继承未变的 R3 玩法验证，新增约474米原生地形路线和所观察相机视角有限PASS；Node几何验证不冒充原生完整重跑。当前地形画面与概念图仍有细节密度、岩壁尺度差距。

复查：打开 http://127.0.0.1:4173/ 刷新后继续原档；WASD/自动步行=，V换视角，Esc暂停。新调查可从(0,190)向北走约332米，观察两侧坡面，再向东走约142米检查坑内；不清除用户原档。完整独立步骤见上述报告。发布备份 artifacts/backups/phase1-20260916，安装及HTTP证据见 versions/INTEGRATED-PHASE1-R4.json、versions/PHASE1-R4-ENTRY-CHECK.json。

新总控01a0aa0f-8ae3-7741-a5bd-ca72f9ffa5bc（cb21）已接管，三路可见任务见 PLANET-ACTIVE-TASKS.json。当前推进连续盆地→平原/山麓→河流/森林→湿地/海岸→海洋与高空飞行；R4不代表完整星球已实现。工程半径120000米可配置、统一种子star-abyss-planet-v1。全部新增3D先图后实现，星球候选尚未发布。


## 2026-09-16 连续星球 MVP-R1 已发布

原入口 http://127.0.0.1:4173/ 已安装连续星球候选，共74个精确核验文件；没有重置E盘工作区或用户存档。原R4与所有被改文件备份于 artifacts/backups/planet-mvp-r1。bundle SHA256 c1c0baba42b3ce5e7ccbaf6a97f39ea9b153f542db3961f6b2b1abebcd3557e0。安装清单 versions/INTEGRATED-PLANET-MVP-R1.json，HTTP核验 versions/PLANET-MVP-R1-ENTRY-CHECK.json；HTML、JS、CSS、旧玄武岩纹理与怪物GLB均200且匹配磁盘。

同一120km半径星球保留旧盆地，接通平原/山脉/森林/河流/湿地/海岸/海洋/断崖、全球LOD、生态碰撞、P勘测到营地整备、连续高空飞行、径向地面/停车/读档和M行星地图。先行两张实际概念图及来源在docs/art/planet-v1；美术为风格化程序MVP。

验证：79/79星球自动测试、393/393旧游戏测试；独立全球运行时审计10/10，原生分段跨界/采样/近地降落/高空下降/背面驾驶与停车刷新/跨LOD远停车整档恢复PASS，地图桌面与390px窄屏交互PASS。发布后4173隔离test模式实测原着陆点Z190→155步行、V第三人称，紫色天空/环形星体/人物/旧外勤HUD保留，浏览器error日志为空。

游玩步骤：普通入口刷新后继续原档；完成旧章调查并修好车后沿东行河谷勘测平原、森林、湿地、海岸，停车步行按P；回营地P整备后长按G连续升空，松开下降。M行星图可选目标，V换视角，F停稳上下车。隔离快验入口 ?test=1&planetFixture=forest / orbit / backside-vehicle，不写原存档；只有额外persistTest=1才写独立测试键。

边界：未完整原生重跑开局→34km全勘测→240km→返回；长流程有同数据逻辑验证及关键分段输入验证，不能宣称全程实机验收。持续油门+Space原生长按未覆盖，实际runtime刹车测试通过。水下不提供步行/潜水。详细证据与历史发现见PLANET-INTEGRATION.md及三份独立报告。


## 2026-09-16 · PHYSICS-SLOPE-R1

车辆九点坡面支撑、骑手随坡、断崖重力、空中存档恢复、人物落地/爬坡、野怪三维攻击距离与坡度判定已修复；精确地形分块减少不可见山体绘制。构建通过，393 项原有测试及123 项 mjs 测试通过。同坡面浏览器180帧实测平均16.666ms，三角形从1155379降为690379。复测步骤和验证边界见 [PHYSICS-SLOPE-R1](docs/development/PHYSICS-SLOPE-R1.md)。


## 2026-09-16 · SUPPORT-TERRITORY-R1

修复岩边脚底无形支撑、下落吸附与停车周围空气平台；野怪自主巡游/警戒/追击/返巢，驾驶时仍活动，接入骨骼行走。构建及543项测试通过；浏览器确认旧悬空点自动落地、静止玩家被巡游野怪主动发现攻击。复测步骤见 [SUPPORT-TERRITORY-R1](docs/development/SUPPORT-TERRITORY-R1.md)。


## 2026-09-16 · TEST-LAB-R1

独立元婴R4实验室已整合驾驶双视角与性能修复。入口 /test-lab.html；F2面板提供地图/飞行/驾驶/战斗/采集/背包真实入口，正式存档隔离。562项完整回归通过，Worker与实验室联合8项浏览器验证通过，正式存储哨兵不变。实际应用连续行进180帧平均16.666ms、P95 16.8ms、像素比1.25（仅所测场景）。操作与范围见 [TEST-LAB-R1-RELEASE](docs/development/TEST-LAB-R1-RELEASE.md)。

## 2026-09-27 · Godot 原生相机、飞行与动作 R2

按用户分工，Sol xhigh 修复代码并集成，Astra 使用已生成的两张参考图和本地 Blender 制作动作与术式。原生入口为根目录 `启动Godot试玩.cmd`，项目为 `godot/project.godot`；本轮没有改浏览器入口或重置用户存档。

- 第三人称相机对真实墙体和裂翼兽相机代理做球体扫掠；近翼膜淡出，距离过近时隐藏角色以避开镜头穿模。角色行走与高速飞行保持实体碰撞。
- 修正贴地仍处于飞行的状态、起飞灵息阈值浮点误差和长按 G 恢复起飞；落地每秒回复 4% 灵息，25% 可起飞，HUD 显示恢复倒计时。Space 仍只跳跃，C 降落，Shift 加速保留耗能。
- 主场景统一使用 12 段 60fps C2 动作：独立 6.8/10 m/s 跑步、前后左右步态、全身前倾飞行、平滑侧倾、拳脚/格挡/受击/施法及移动中上下身混合。修复拳头偏侧、循环首帧停顿和格挡旋转累积；不重写骨骼 rest 或逆绑定。
- R4/R5 气刃、R6/R7 开口弧环、R8 细裂隙、R9 分段道环已接入真实施法与伤害时序；透明边缘与近镜头淡出避免整块遮屏。本轮未替换瞬移门。

最终实现方主场景自动验证：基础 52/52、移动 31/31、存档恢复 21/21、瞬移 11/11、空战术式 9/9、R2 集成 37/37，载具与墙/翼相机探针通过。完整场景 OpenGL 截帧见 `godot/reports/r2-main/`；独立相机/飞行回归和画面复核见 [独立报告](godot/reports/INDEPENDENT-VERIFICATION.md)。渲染与自动场景验证不等同于用户完整键鼠手感验收，也不证明原两张截图的唯一根因；未宣称全游戏迁移完成。

复测：先在旧窗口 F5 保存并退出，再用本工作树的 `启动Godot试玩.cmd` 打开新版；WASD/Shift 检查跑步与贴墙滑动，G 起飞后 Shift+W 并交替 A/D 检查前倾和侧倾；移动中左键连击、右键格挡、升空按 R，F6 可切试玩境界；C 落地后观察回息提示，再按 G 起飞。详细说明见 [原生试玩](godot/README.md)、[角色与操作](godot/docs/PLAYER.md)、[动作制作与验证](godot/assets/motion-r2/README.md)。

### 2026-09-27 格斗动作续修：手形仍待完成

用户再次指出手脚不自然，继续由原 Astra / Sol xhigh 会话协作。研究了 Skullgirls 主动画师 GDC 讲义及 Shadow Fight 制作方的发力分离/补偿资料（来源与落实项见 `godot/assets/motion-r2/README.md`）。修正格斗时普通 idle/跑步覆盖骨盆双腿的混合方式，增加前后脚支撑、髋肩发力、护头架势、提膝—伸腿—收膝及独立空中动作；当前 GLB 为 19 个动作片段，正常速度连续预览在 `godot/assets/motion-r2/evidence/combat-sequence/`，真实主场景三连在 `evidence/main-combat/`。

代码补齐小幅出招步移、短输入缓存、接触后衔接与连击超时，受击/瞬移/上车取消旧攻击，真实命中才触发局部停顿。最终主场景按实际腕/踝与目标身体判定接触：同一三连在 2.3 米全部落空，2.0 米依次命中，正常速度对照及事件记录在 `evidence/main-combat/main-contact-2p0m-normal-speed.gif`、`main-contact-2p3m-normal-speed.gif` 与 `events-contact-refresh.json`。击退修为单次冲量，脚锁处理超可达锚点，真实离地再选择空中受击。最终真实 60Hz 动态战斗回归 20/20 通过，基础 52/52、R2 主场景 37/37、移动 31/31、空战术式 9/9、恢复 21/21、瞬移 11/11 回归通过。独立初轮 6 段 318 帧及初次 48 帧复拍未保证物理时基，已撤回其移动速度、位移、脚滑和物理自然度结论，仅保留动作顺序/姿态观察。最终重新以真实 30Hz 物理帧拍摄 48 帧受击（`after-hit-physics-30hz/`），记录 SHA、UTC 与实际帧步长，普通受击贴地、后仰后平顺回正，详见独立报告。先前仅从阴影推断“悬浮半米”的说法也已撤回，不能当作实测高度。

**本轮不宣称手脚问题全部完成。** 原手套半张开且只有腕骨，闭拳手形仍未通过。已提出仅新增 1 张手套闭拳/半握三视参考图的审批，前一批 2 张授权已用完；用户尚未回复前不调用新增生图或付费 3D 服务。可先重启原生试玩检查左键三连、移动出拳、右键格挡/撤防受击以及空中连招，关注支撑脚、收势与打断；手形需获准后继续制作和验收。本轮独立验证没有写入正式存档。


## 2026-09-27 · Godot R3 地空对打（已测闭环通过）

用户要求已分派六个新会话：飞行控制、人物动作、武技集成、武技特效、野怪、独立验收；分工见 godot/docs/R3-SESSIONS.md。本轮沿用已有生成参考图，本地 Blender 制作，没有新增生图或付费 3D。

已实现鼠标俯仰三维飞行与 Shift+C 下降加速，Space 仅跳跃；人物改为51骨/29片段，原19身体骨与C2身份保留，局部重做分指手套，步态匹配1.6/6.8/10米每秒；R4拳、R5掌、R6/7横扫、R8下劈、R9压掌，地空动作、骨点释放、命中和打断同步。地面普通兽与地空精英含7招、追击、格挡减伤、死亡掉落与存档；F2前往裂翼岭，F3重置两兽且阻止重复奖励。

最终动作GLB e0f5cb5d...与Player917a50bd...的独立同批近战验证：2.0米gap0命中，2.3米gap0.150命中，2.6米gap0.450落空；真实踏步约0.185米，墙前出拳零位移。2.3米是旧模型采样值，不是固定规则；未扩大隐形伤害范围。证据 godot/reports/r3-independent/melee-final-audit.json。开发侧基础52/52、近战24/24、R3技能13/13、空战9/9；这些不替代完整实机手感。独立新步态2140真实物理帧已取证，速度匹配与同锚脚踝位置稳定，不外推鞋底旋转无滑。

最终独立报告 godot/reports/r3-independent/FINAL-REPORT.md（SHA256 eaf861b0bc476dc24c67a373b046da64b5ddd6c8f01a0ef975a8ae30496eceff）：2090真实物理帧综合29/29；最后命中/落空差异300帧定向10/10。R8弯刃可读性修复关闭，960×540中文两行完整，HUD点击可到游戏。无PNG性能基线Intel UHD/OpenGL 1280×720各招平均53.1–60.1 FPS，不承诺锁60。保留一次缺少输入观测的下降停高异常，未归因且未复现；随后同SHA完整带Cdown/支撑/碰撞长链正常落地。未宣称人工键鼠手感、全部鞋底旋转/坡面或全部招式专项通过。

复测：F5保存退出旧窗口，由本工作树启动Godot试玩.cmd重开；Ctrl+W慢走、W跑步、Shift+W冲刺；G起飞后上下鼠标+W、C/Shift+C；F2到裂翼岭，左键拳脚/右键格挡/R武技，F6切境界检查不同动作，击杀H拾取再F5重开。F3用于重复对练，不用于重复刷奖励。


### 步态 R4 续修（平地走跑限定复验通过）

继续由原Astra动作会话与独立验收会话处理，仅走/跑/冲刺及过渡。旧版实际侧视和原始/运行时骨骼轨迹均确认跑步髋前屈过大，脚踝最高点接近身体正下方，慢走脚锁另有骨盆下压；此前速度/脚锚数值通过不等同于自然步态。计划重做后摆收跟与低位前摆、支撑脚跟到脚尖滚动，沿用已有生成参考图，不新增费用。独立旧版源与三视图基线位于 godot/reports/gait-r4-independent/；第二轮候选已完成：低位前摆、身后收跟、膝关节落脚缓冲、适度前倾，脚跟/脚尖滚动支撑取代固定脚踝；移动速度仍1.6/6.8/10m/s。候选01因直膝前踢未通过，候选02由独立376帧近正常时钟侧视、三视图及六段起停限定通过。GLB942f372de11641e9c8189f2aef39ed68956e4eed1d54bd14243cb86f022e2430、驱动95d3a7df91e2dfe5128fd0a649c0e8696457f4d8dd07f178374a4018dabb78c6。证据godot/reports/gait-r4-independent/FINAL-REPORT.md（SHA b8be7481317ca30320c6817e5dc8a2f2915bba384c45f02fcf52cb7c85a0cc83），不扩大为全部坡地/鞋底旋转/人工手感通过。开发侧全蒙皮检查仍记录平地鞋底最低点误差（走路约-4cm、跑步约-1cm），属于待完善边界。桌面快捷方式仍指向本工作树，无需替换。

复测：保存退出旧游戏，再双击桌面星渊 Godot 试玩；平地依次Ctrl+W、W、Shift+W，每次松开停住，从侧面观察是否还高抬膝、直腿踢脚或突然弹跳。新旧连续预览在独立目录baseline-light与candidate02-light的side-wall-time.gif。


### 连续原生星球与图先行动作 R5（开发中）

用户要求按初始星球文档消除6km方形截边，地面连续、地貌交界不规则、近地局部平坦、太空见完整球体。原生World此前仅迁移6km盆地；现按既有120000米工程半径移植连续球面地貌/LOD/真实碰撞，保持旧盆地、存档与玩法。world内部agent、原Player/Main Sol会话、原动作Astra和独立验收并行，统一契约godot/docs/PLANET-NATIVE-CONTRACT.md。

用户长期规则已加入AGENTS.md与docs/3D_VFX_ENGINEERING_SPEC.md：具体动作/武技/特效先image详细拆解，再检查、Blender制作、Godot正常时间对照。本轮新生成2张走跑图，独立发现部分相位/左右腿错误，错误面板排除，未作为完整动作通过；追加1张针对缺失姿势补图的申请待用户回复，地形及无依赖工作继续。此记录不代表星球或R5动作已完成。


### 2026-09-29 — 用户盆地 1.6km 方块回归修复与动作审核分流
- 已实读桌面快捷方式及启动脚本，指向本 C 盘工作树 godot；用户不是打开了错误入口。
- 修复盆地高空区域 LOD 覆盖、双面地形光照法线；移除试验性的 screen-door 过渡。旧 near 块裙边仅在高空隐藏，碰撞只使用地面顶面三角；轨道精纹理覆盖渐退消除 24km 方形纹理。
- 新版核心回归 52/52、球面存档 21/21、瞬移 6/6、载具 6/6。新版正常 Main/Player 自动物理与视口输入太空往返 12/12：125039m 上升、136439m 停升后返地，10548 帧，175.80s 模拟/177.41s 实际，12 文件首末 SHA 一致。
- 独立针对性验证：1.6km 指定暗横线消失，350m 上下切换未见大洞；地面实际 z200 块边 W 从 z205 到181.782，速度连续、unready=0、AGL最大0.000942m。仅覆盖所测样本，不代表所有坡地/接缝。证据见 godot/reports/planet-native-r1-independent/BASIN-SKIRT-FOCUSED-REVIEW.md 与 GROUND-EDGE05-REVIEW.md。
- 轨道小暗块层隔离显示隐藏整个 planet 后仍存在，独立 CPU 对照确认小暗块仍附着人物，排除残留地形方块，与背部装备轮廓一致（未隔离具体人物网格）。最终限定结论见 BASIN-FINAL-SCOPED-CONCLUSION.md。左球缘锯齿、纹理颗粒与首次加载帧尖峰仍为画面/性能限制，不宣称所有 alias 或卡顿已消除。
- 复测：关闭旧游戏进程，双击桌面星渊 Godot 试玩；原位置升到约1.6km缓慢转镜头检查方边/暗线，300–500m上下飞检查切换，再落地走过营地与块边。无需删除存档。
- 走跑动作已新建审核 session 01a0ecbe-db86-73d0-977e-cb32273aa524，先多张图片设计，用户在该 session 明确同意后才开发3D；当前没有将新走跑动画作为完成版交付。

### 2026-09-29 — 撤回轨道方块全部清除结论
用户新图 codex-clipboard-855cbcaf-e541-49e0-a7fc-367481084e9b.png 明确显示大四边形地块。开发复核确认大patch随planet._far_root隐藏而消失，小装备轮廓仍在；先前将二者混淆，不能据小轮廓判断所有地形方块已清除。根因定位为远景烘焙顶点颜色继承legacy_weight的方形3–4km范围与粗分辨率basin染色。轨道方形地块未解决，撤回此前全面完成措辞；已过的特定1.6km暗线、真实块边与飞行功能证据仍按原范围保留。当前按用户指令新session 01a0ed39-788c-7af3-be8e-58cb51c99d93 先制作完整地形图片供审核，未授权以图片交付冒充3D实现。

### 2026-09-30 — 总控与原 Astra 会话切换 GPT-6.1 Sol high，继续未完成项
- 用户要求切换模型；生态、武技、地形图片审核、走跑动作及当前总控均已通过会话工具指定 gpt-6.1-sol/high，沿用现工作树与已授权范围。走跑会话中已有用户批准3D开发记录，不能继续以未批准为由阻塞；视觉未获认可仍须修。
- 高阶返地 owner 报告：surface-blink-runtime/1535947/runtime-verification.json，138检查无失败，R9真实Ctrl+Q从约125km到干地AGL0.8m，R8拒绝该距离、取消/新障碍/消耗CD通过；高空由restore夹具建立，不冒称该测试从地面自然飞行。
- 已知未完成：岩片在坑上方悬空（现直接证据为正式资产手工register联测对象，尚未独立判定自然流送路径）；生态stream/query尖峰与forest重载；AI落地/E就绪；树木/岩石/武技/走跑视觉与参考图差距；完整地形图还原。功能检查不等美术通过。
- 独立QA继续核验证据，生态接定向support修复，避免退回旧地面平面；当前无新增生图预算。

- 2026-09-30 独立CPU复核补充：PERSISTENCE-BLINK-CPU-REVIEW.md确认两OS恢复证据，但rock仅state相等不等完整碰撞验收；generation保护是合法新schema改旧标签的构造样本，非历史r4.1拓扑实档；关闭保护调用生产notification handler，非真实OS窗口事件。当前高Q artifact AGL125002.09795→0，与旧口头转述数字不同，已要求按case/source SHA更正，功能/美术/历史兼容范围不扩大。
