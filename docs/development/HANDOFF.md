# 新总控交接单

> 当前路线：以图一原游戏迭代，旧D1独立入口已退役。详见 [ORIGINAL_GAME_REBASE](./ORIGINAL_GAME_REBASE.md)。

2026-09-12。用户要求全新会话接管总控，并且每个开发交付各开独立功能测试会话。不是fork旧对话，不要求搬运完整聊天。

## 权威资料与责任

主项目绝对路径：`E:/myProject/star-abyss-game`。先读此目录的`docs/development/CONTROL.md`、`TASKS.md`、`docs/cultivation/README.md`、`PROGRESS.md`。设计共29份（入口＋01—28），图文入口`docs/cultivation/illustrated-guide.html`。当前纯设计内容不可当已实装。

新总控拥有主项目开发总控、任务登记、审核集成与派发后续任务责任。分开发对话在隔离工作区，只拥有各自模块；主项目有大量未提交和未跟踪改动，不允许整仓覆盖、重置或直接切换原目录分支。优先cmd，保持现有资产，不运行收费生成，不传播历史凭据。

最新用户规则：同一宠物迷你日常/完整战斗两模式；消耗后才换不同新代；原器等有世界根唯一账；游历NPC真实采集、携物、抢夺与销赃；地图是情报/资格实物；普通成长与极稀有天命核心分开。

## 已派发但尚未确认运行的开发任务

|任务|创建回执（非正式threadId）|范围|
|---|---|---|
|DEV-A 星渊战斗数值基础|client-new-thread:bd2a34d9-37ed-48b2-8eb5-18ab2b5522c7|d3-combat数值与盾/抗性/多段|
|DEV-B 星渊背包与库存事务|client-new-thread:02a3e006-eadf-4b28-903e-4f951032a71d|d3-inventory容量/转移/去重|
|DEV-C 星渊刷新与世界唯一账|client-new-thread:963af614-68fd-422f-85f9-97b814749f57|world-director消耗/新代/唯一账|

上次工具确认已建三个Codex worktree：`C:/Users/HUAWEI/.codex/worktrees/2f23/star-abyss-game`、`.../8712/star-abyss-game`、`.../bb9f/star-abyss-game`；**尚未核实它们和A/B/C的对应关系**。最新任务列表仍未返回A/B/C正式ID，不能编造已启动、已完成或测试通过。

新总控第一步用任务列表查正式threadId与状态，检查报告/工作区证据，再更新TASKS。不要因一时未出列表就重复创建三份开发；若证实创建失败或任务不存在，记录证据后再补建。client-new-thread ID不能传send_message/read_thread/wait_threads。

正式ID就绪后通知各开发：总控已迁移；完成后由新总控各建TEST会话，不自行集成或修改主入口。只有已验证的工作区/交付版本可送测；尚未完成则持续开发，别创建空验收。

## 接下来的流程

1. 确认三开发会话与工作区，登记真实状态。
2. 按CONTROL的模块范围让其完成代码、定向自测和DEV报告。
3. 每个功能完成，创建一个全新TEST会话直接验证；使用真实交付文件，不误测默认分支旧代码。测试优先隔离证据目录，禁止覆盖主项目脏改动。
4. 报告失败送回对应开发修复；修复版本新建单功能复测会话，通过后由总控审核集成。
5. 联动/界面另立功能测试，随后推进一场真实战斗→材料→库存→加工闭环及同宠双模式样板。

本交接不自动归档旧会话，不清空任何工作区，不把模块测试通过冒充3D玩法实装。未创建定时监控；新总控应在其活动期间用任务状态工具跟进，不声称存在后台通知自动化。

2026-09-12 D1当前交接：DEV-D1-R1已冻结，版本SHA256 7a12281c3e284986a3ccccbd31fdc06b52f3e6798df83add8b59d5523cb285eb。新独立TEST-D1-R1（01a09529-f3ac-7493-9254-0b338b933119，a047工作区）运行中，等待单版本真实3D操作结论。主目录仍仅集成A-R2/B-R1/C-R2/I-R2；D1未集成。失败交原开发修复后必须再建新TEST；通过则先核对冻结哈希及主文件冲突，再按所有权集成并归档独立证据。D1为独立白盒，营地只存无取、加工D2/同宠E未实现。

2026-09-12 D1最新状态：TEST-D1-R1 FAIL（F01 P2墙角追击振荡阻断；F02 P3耗尽提示错误），已退原DEV修R2。正式报告reports/TEST-D1-R1.md及66文件证据已归档，57被测文件哈希确认未改。服务4193已由TEST停止。主代码仍为A-R2/B-R1/C-R2/I-R2，D1未集成；待R2新冻结交付后新建独立TEST-D1-R2，不能复用旧TEST结论。

2026-09-12 D1最新交接：DEV-D1-R2已交付并冻结：95自有+9依赖+版本清单共105文件，version-r2.json SHA256 164b845b7a06385bb05641cd87e577a76decab0cc4bd2f1a4248dd397c953dc7。总控全哈希核验、R1的57文件冻结副本及旧证据完整核验、check-r2只读检查通过。开发13/13、旧独立用例开发重放9/9不计独立验收。 全新TEST-D1-R2任务01a0954e-85dc-7523-a9fa-bb8bfbcb15ee，工作区C:/Users/HUAWEI/.codex/worktrees/bca0/star-abyss-game，wait_threads确认inProgress。重点独立实操原失败站位附近和墙前中/左右绕障攻击、空源提示与刷新返回重复F，并回归真实战斗/同档救援/满包回滚/存放拾取/完整根刷新及布局。D1仍未集成，等待新独立结论。 冻结源在总控artifacts/deliveries/DEV-D1-R2。只用serve-r2/start-r2入口；保留的R1 serve/verify不得运行写旧证据。

2026-09-12最新：TEST-D1-R2独立PASS并完成D1-R2集成：开发Node13/13、旧独立9/9、新独立8/8，主目录重跑30/30；实机矩阵30/30，原生证据20组断言不重复计数。F01墙角追击与F02空源提示在本白盒范围关闭。105冻结文件/测试副本及Three3文件、201证据条目/报告SHA均核验；97个新文件独占写入，9依赖仅检查不覆盖。202份独立证据归档，清单versions/INTEGRATED-D1-R2.json与TEST-D1-R2-EVIDENCE.json。主回归后再次核对全部集成文件和归档证据字节一致（寻路用例会重写path-traces.json，本次确定性输出仍与原SHA相同）。 独立场景入口playable/src/d3-scene/start-r2.cmd（默认127.0.0.1:4182），尚未接原main；营地只存无取，无加工/宠物/自动再生。旧R1入口/verify为历史保留，启动使用R2入口。独立报告reports/TEST-D1-R2.md明确未测精细跨范围/转向/动态遮挡时序、故障注入等，未冒称全覆盖。 主目录现有A-R2/B-R1/C-R2/I-R2/D1-R2。未覆盖原game.js、main/input/camera、package或资产；未提交推送。

2026-09-12设计侧新增交接：已接收设计变更DESIGN_CHANGE_SUPREME_FACTIONS.md，权威章docs/cultivation/29_SUPREME_FACTIONS_AND_STORY.md。一神国/二洞天/三学府/四圣地（TF01—10），领袖等级99、98/97、97/96/96、95/95/95/95；20下属门派SS01—20，新增N39—68，固定设计名册38→68，原38身份/服务及S01—06保留。此为设计登记，未实装。 后续NPC/剧情切片先限ACT01：N63苏晚照、N67牧青禾两位低阶代表与一条真实协作任务，顶层组织先用档案/信物体现，不启动十个终局星球。个人信任/仇怨、组织态度和已知证据分别存储；同行先限1名人类并与同一只双模式宠物共存，计入AI预算。真实物资分账/唯一账、证据触发敌意、菜单退出恢复输入后才允许敌对前摇、死亡继任不复制原人/原物为后续实现验收条件。六幕按R0—R9阶段衔接，不扩当前开发。 仅补总控计划；D1-R2仍为已验收独立白盒，后续视觉小样/原主接线/加工D2/同宠E依原阶段衔接，新增世界观不触发D1重测或自动扩建终局。

用户纠偏（2026-09-12，覆盖此前独立白盒产品路线）：唯一产品基线恢复图一原游戏playable/star-abyss.html，4173入口，约6×6公里原地图/角色/载具/星空/调查/旧存档保留。白盒95文件移入artifacts/retired-d1-whitebox/20260912，运行目录d3-scene及对应test已移走，4182无监听；A/B/C/I规则及历史验收档案保留。原main/game.js/资产未更改，主4173 HTTP200。

已新建并确认运行三个分会话：DEV-ORIGINAL-CORE 原游戏玩法接入 01a095eb-c6dc-7bd2-a512-3889505e68a5（a6f0）；DEV-ORIGINAL-WORLD 大地图遭遇与场景 01a095eb-c6de-7f91-a4d9-3d02f79dbd72（93ad）；DEV-ORIGINAL-UI 原游戏HUD与背包 01a095eb-c6e4-7140-baca-8c8870ba29bc（7d07）。接口直接互通并抄总控，所有权/实施合同见ORIGINAL_GAME_REBASE.md。187文件当前原游戏快照ORIGINAL-BASE-R1供隔离开发，禁止从旧Git HEAD误还原。交付分别新建独立TEST，最后再做唯一原入口整合实机测试，通过前不覆盖主bundle。

原游戏并行接口协调：CORE确认I-R2固定白盒pose边界阻断原米制世界保存；已派原DEV-I任务01a094d9-4b8a-7890-a238-0effc66ca873（7737）开发I-R3配置化世界/pitch边界，wait_threads确认inProgress，交付后另建全新TEST-I-R3。旧R2默认校验不放宽，请求不能覆盖边界/safePoint，配置深复制；validateRoot无config与session配置一致性须全调用链处理。原WORLD.halfSize3000、spawn(0,190)、pitch±1.35，yaw由CORE规范至±π。CORE不缩放坐标、不改I、不直接写根，其他工作继续。

CORE接线合同：现有world.scene可直接挂载，无需扩大scene.mjs所有权。新增R攻击/H采集拾取/I背包，保留F原交互/上下车及空格原功能。UI v1已发布于7d07工作树DEV-ORIGINAL-UI.md：createExpeditionHUD({onAction})返回update(view)/destroy；screen playing/inventory/rescue可见，其他隐藏；menu事件由CORE协调输入释放/恢复和暂停战斗，业务由CORE执行，UI仅显示权威pending/error/save。开发契约不计验收。

ORIGINAL-UI阶段状态：7d07初稿Node投影3/3，仅开发中、未冻结/未实机/不集成。上轮Windows Computer Use自动策略因无法可靠识别当前浏览器URL要求停止该轮，开发已遵守，不列产品缺陷。总控核对报告及computer-use SKILL/guidance后发起新一轮，优先使用本轮可用且能识别明确localhost:4196的专用浏览器接口；若仍被停止必须遵守，不换路径规避同轮拦截。待多宽度实机验证、契约统一并冻结后再新建独立TEST。CORE继续逻辑接线但不把初稿当已验收依赖。

ORIGINAL-WORLD阶段更新：开发自报Node5/5，覆盖4路线扫掠、原movePlayer积分、静态LOS与Three权威view/LOD/dispose，localhost4207预览可达；总控未将其计作独立或实机通过。Windows Computer Use上一轮URL识别策略停止，开发遵守。已要求结束受限轮后，在新轮用可识别明确URL的允许浏览器入口继续真实步行/驾车验证；再次停止则遵守，不绕过策略。4处/12源/4敌接口可供CORE开发协作，候选冻结不等于完整交付，主项目暂不集成，后续仍新建独立TEST。

WORLD-R1技术候选已核验：8清单文件+version-r1.json共9文件，187原基线哈希不变；保存于总控artifacts/deliveries/ORIGINAL-WORLD-R1-CANDIDATE，未写主产品目录。状态仍MODULE_FROZEN_UI_UNVERIFIED。WORLD新轮明确URL浏览器验证已在运行，开发未完成，不创建声称就绪的TEST、不集成。后续实机证据或源码更新须新清单版本，候选快照保留。

I-R3开发完成已核验冻结47文件（39自有+7依赖+版本清单），version-r3 SHA256 ce42b6d0363105791b0a3a3cae9060221f749b6a7ec8ae7ae4cb51cf1cc742bd；26份R2基线与主依赖/旧证据完整。新独立TEST-I-R3任务01a095f8-627f-73c0-805c-dc0e5c2c57a4（5a02工作区）已运行，验证大世界固定配置贯穿、边界与错配/篡改拒绝、真实IDB原子保存救援和R2回归。主目录仍I-R2，独立通过前不升级。

原游戏并行进度：UI专用IAB恢复成功，已做多宽度真实点击并修Tab冒泡/窄屏提示遮挡，仍待最终冻结；WORLD技术候选保留，新轮已在原月面真实步行，实机继续；CORE定向Node5/5自报，已使用冻结WORLD三源文件作未验收开发依赖，4211隔离预览准备中，未改原bundle。

WORLD开发预览纠正：R1 preview精确匹配game.js遗漏HTML的game.js?v=...，浏览器实际仍载旧bundle。此前4207的原角色/移动截图只能证明原游戏运行，不能证明WORLD挂载，相关新增区域实机结论撤回为待测。R1候选保持原哈希；开发新增preview-r2.cjs/4208重测，需先核实DOM脚本URL、实际bundle及WORLD挂载，再真实到4点并留证。三个源模块据开发报告未因本预览修复变化，CORE可继续未验收开发接线，但其4211也须检查带query的实际加载链。未集成主产品，未独立通过。

ORIGINAL-UI-R1完成开发冻结：总控核验26文件，versionSHA a8f4ab39bb5ef27407756816731c3026095e8bc86163ecdac5c07441634ac714，186原基线文件及主CSS基线一致，查看390最终背包图。新TEST-ORIGINAL-UI-R1任务01a095fa-f3ec-7be0-b62d-dc0d08382faa（1325）运行中，独立验证多宽度/原UI快捷键/长列表/持续update焦点/destroy/请求事件。开发3/3、四宽40按钮命中只是开发证据，未计独立通过。产品只有index.mjs与CSS，fixture/预览不能入真实main；CORE已获冻结源用于未验收开发接线。真实战斗/存档/菜单暂停须最终CORE整合另测。

I-R3独立PASS并已集成：独立Node9/9、真实IDB12/12、R2真实IDB7/7，真实刷新后整根一致；总控核验报告SHA 44f9031a5f19147d9a98dcea228bb0ccdecdbc0a0d24db39b013523e66cf9ee1及75证据条目、47被测副本哈希。升级前核对主I-R2原SHA，5文件更新/15新增/21保留/7依赖仅校验，旧文件备份总控artifacts/integration-backups/I-R2-before-R3。76证据文件归档，清单INTEGRATED-I-R3.json及TEST-I-R3-EVIDENCE.json。主Node15/15，通过preload仅重定向新测试JSON输出，测试后全部集成文件/证据SHA一致。CORE可按清单接入I-R3继续同原存档实机；此PASS仅同根存储，不代表原大地图/载具/战斗整合完成。

TEST-ORIGINAL-UI-R1独立FAIL：开发Node3/3、独立Node3/5；短列表四宽40命中通过不代表长内容通过。P2 D1未知null/空字符串投影0/0且缺items误称空库存；P2 D2 390长列表挡原T、附近提示覆盖原HUD；P2 D3仅仓库label更新重建按钮丢焦点。总控核验报告SHA2525a86e36d2858ddee49e8bcb4dcb544c1fb7762b0c0cf9293b24993a23a644、58报告/证据条目及26被测文件，主归档58证据文件及TEST-ORIGINAL-UI-R1-EVIDENCE.json。退原UI开发R2，新冻结后必须新建TEST-ORIGINAL-UI-R2，主UI未集成。B1真实Shift+Tab被原input抢焦点列CORE联合门槛：菜单打开停用原input/暂停战斗、正确恢复，不能用合成DOM反向循环代替实机。CORE可继续其他开发但UI-R1不作为通过依赖。

UI-R2修复冻结已核验43文件（42条目+版本），versionSHA 27de348c55a7a89ed03f2a179596ea7a8373e102d201fa113b826874e3050574；186原基线及两份R1完整快照/旧证据不变。新独立TEST-ORIGINAL-UI-R2任务01a09614-8b77-7572-b894-f33fa54e6ca8（eead）已运行，针对未知数值/长列表避让/稳定焦点三P2及原UI回归。开发Node9/9/DOM12/12/四宽64命中不计独立验收。CORE获冻结index/CSS可临时联调，主目录未集成UI，最终仍等新TEST和CORE联合实操。CORE新实机自报同旧档原生R击杀怪96→0/玩家120→100、唯一掉落2，11-real-kill原根证据，继续H拾取/刷新及满包回滚。

WORLD-R2正式交付已总控核验26文件（25条目+version），versionSHA e7f13376d896e62f03eb3c36172ada0dba8a5fa8439b3e58931fb015cd7d0dfb；187基线/原R1候选不变，查看最终足底截图。三产品中仅index两处腿原点.70→.61，SHA7200129cc28d1bb1ec658d6355fad6f6e0f55be7a1aba2b5da8027c23a9524e3。新TEST-ORIGINAL-WORLD-R2任务01a09620-ec24-7830-b06c-74124589ddb9（4a51）已运行。独立复验最终同版四点实走/足底/静态碰撞/LOD/原图保留，持续驾驶和CORE动态AI/业务边界不冒称通过。开发四点到达截图早于足底修正已在报告区分，不作为新TEST同版证据。CORE可核验更换三产品开发依赖，主WORLD/UI尚未集成，最终仍待独立结论。

UI-R2独立TEST未通过（01a09614-8b77-7572-b894-f33fa54e6ca8）：未知值与390长列表旧缺陷通过；独立DOM21/24，仍有删除当前物品/数量归零/关闭仓库导致焦点落BODY的P2，以及768导航背景重叠7.1px的P3（文字未遮挡）。报告SHA a1ab6c06d15b9e4ae562d7cc5fb900c102707c095721d46b5ff5e259be443c07；73证据已归档。已退回原UI任务开发R3，保留R1/R2冻结，要求失效操作立即转到可用按钮并覆盖pending、四宽避让及原生延时实操；交付后另开独立TEST-R3。开发当前重放DOM24/24不计验收。CORE真实营地存放复现焦点问题：包矿11→10/仓1→2、35→33kg；升级WORLD-R2后同档刷新原故事与修好载具保留，继续释放容量后的采收验证。WORLD-R2独立任务仍实走原大地图。主目录尚未集成CORE/UI/WORLD或重建原game.js。

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
