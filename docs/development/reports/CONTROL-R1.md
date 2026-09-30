# 新总控接管与R1集成预审

> 当前路线：以图一原游戏迭代，旧D1独立入口已退役。详见 [ORIGINAL_GAME_REBASE](./../ORIGINAL_GAME_REBASE.md)。

2026-09-12。总控任务 `01a094be-fe94-7c23-9b24-13f777c81d8d`，工作区 `C:/Users/HUAWEI/.codex/worktrees/c0e3/star-abyss-game`；权威主项目 `E:/myProject/star-abyss-game`。

## 核验结果

- 按交接顺序读取主目录HANDOFF、CONTROL、TASKS、cultivation入口、PROGRESS。项目及当前工作区未找到额外AGENTS；上级全局规则与用户提供内容一致，使用cmd、保护脏改动。
- 列表未列出DEV时没有重复创建；从本地会话元数据取得正式ID后逐个调用read_thread，确认三个DEV交付回合completed、工作区对应关系、代码与报告真实存在。正式ID与测试状态见[TASKS](../TASKS.md)。
- 三个DEV已分别确认迁移、冻结实现及测试；只修正自己的报告文案，将开发自测与独立验收分开。
- 每份源码/自测按字节冻结，manifest记录SHA-256；每个模块分别新建TEST-R1，正式ID、工作区和inProgress均已核实。测试从冻结真实文件执行，未测试默认基线旧实现。
- 主目录原有大量未提交/未跟踪改动已核对。没有整仓重置、切换主分支或覆盖资产；当前只维护总控相关文档。未运行构建、收费生成、提交或推送。

## 接口预审与集成门

所有模块运行时依赖只在自有目录内：A依赖fixed.mjs，B无导入，C依赖rng.mjs。主项目CodeGraph对新增目录没有有效关联，采用局部导出与事务函数阅读；不据旧图推断已接入场景。

|边界|核对情况|下一切片要求|
|---|---|---|
|A→C击败|A发出标准defeatCommitted；C要求群成员实例ID|角色敌人ID直接映射C成员ID，不能传怪群ID；死亡与掉落只提交一次|
|B→C耗尽|B最后一份成功转移才有resourceDepleted；C接受同一最小事件形状|B资源容器sourceInstanceId映射C资源当前代，部分采集镜像可选|
|根保存|A返回新态；B异步CAS；C同步persist且默认内存确认|在根快照副本计算A/B/C变更，只对真实根存储做一次CAS，成功后发布；不能将异步IndexedDB函数直接传C.persist|
|时钟|C消耗时读取注入模拟时钟，事件本身不带提交时间|根协调在成功边界固定模拟时间，恢复时不从零重置，不用事件延迟投递时间平移冷却|
|唯一物|B完整物原ID转移；C保留唯一资格/根身份与流转账|库存移动与唯一账同根提交；B尚无片重铸库存实现，不把C逻辑资格当实物加工已完成|
|场景|三份都是纯逻辑交付|安全/碰撞/命中/载具/双视角仍需真实适配与实际操作证据|

独立TEST未通过之前不集成对应版本。通过后仍需检查逐文件哈希、目标路径冲突和自有改动边界，再只复制审核文件。主项目已存在不同内容的文件不得覆盖。模块落盘不等于主游戏可用；根原子协调与真实场景必须分别送独立测试。

## 本轮验证步骤

数值文档勘误：用BigInt有理数独立核验 `497.24×(2/3)×1.10×0.80=291.714133333…`，8位截断为291.71413333，扣50后向下取整241。只替换第19章和离线图文手册内错误中间数字291.714666，图解中的291.714…本来正确，保持不变。验证脚本位于总控工作区 `artifacts/correct-damage-example.cjs`，写后回读一致；这不是代码或场景验收。

1. 用正式read_thread核对DEV/TEST标题、cwd和回合状态；client创建回执不传给状态工具。
2. 对冻结manifest逐条校验源码/自测文件SHA-256和字节数；测试报告必须指向同一版本。
3. 独立测试复跑开发用例，再验证自己编写的边界、失败恢复、重载/去重与状态守恒用例。
4. 失败回对应DEV修复；新版本另冻结、另建TEST，保留旧失败报告。通过后才进入局部集成审查。

当前结论：**A-R2/B-R1/C-R2均独立通过并已按文件局部集成，第一批模块验收完成。未完成联动或场景验收。**

B集成验证：只新增库存模块、自测和两份报告，预检查所有目标不存在后写入，源/目标SHA-256一致；清单 `docs/development/versions/INTEGRATED-B-R1.json`。主目录实际执行 `node --test playable/tests/d3-inventory.test.js` 为17/17通过；独立报告13/13，见TEST-B-R1。没有修改main.mjs、package.json、game.js或公共资产。

C失败门：独立10项中9通过，历史已消耗片ID可被另一原器重新使用。已派回原DEV修复，保留R1冻结和失败报告，修复交付后新建独立R2。

C-R2追加：全新独立复测39/39通过（21开发、10前轮独立、8新增独立），真实R1错误存档after/reloaded均拒绝且输入不变，F01关闭。仅对已核验哈希的R2自有文件作新增集成，清单INTEGRATED-C-R2.json；主目录运行world-director定向测试21/21通过，未接场景。

A失败门：独立17项中13通过，4失败归为F1精度截断漏杀与F2重试别名ID未登记两类。总控接受F1会改变整数生命/死亡事件而非显示误差的判定；F2不夸大为无限重复伤害，只要求已接受ID的请求冲突语义完整。已派回DEV-A，修复交付后另建R2。

A-R2交付：开发22/22、开发者复跑原独立17/17，不算验收。精确BigInt分数贯穿护盾/防御/生命，state.version=2新增carryExact/amountExact；别名duplicate也登记请求并返回新state。总控已审查变更边界，冻结4文件并发起全新TEST-A-R2，重点验证精确盾余数、低于1反例、JSON兼容和别名冲突。通过前不集成。

A-R2验收与集成追加：全新TEST-A-R2正式报告通过，22开发+17前轮独立+11新增独立=50/50；F1/F2关闭。按冻结哈希只新增战斗源码、自测、DEV报告及TEST报告；主目录定向测试22/22通过，归档清单INTEGRATED-A-R2.json与TEST-A-R2-EVIDENCE.json。没有覆盖已有主代码、入口、资产或存档。

下一切片：已提交新建DEV-I同根存档联动，拥有d3-session目录与对应自测/报告，A/B/C依赖只读。最低目标为采收/死亡/完整唯一物流转同根提交及真实IndexedDB CAS、abort/并发/重载；交付后另建独立TEST-I。真实场景D与同宠E仍未启动。

联动完成追加：TEST-I-R1独立Node10/10、真实IDB10/10（53步骤）与六按钮/真实刷新全根一致均通过，总控已阅读正式报告和真实截图、审查IDB oncomplete/abort边界并核验冻结20文件。新增14个自有文件及报告，7依赖只检查不重写；主目录Node13/13。完整57份证据归档，主场景仍未接通。

后续派发DEV-D1真实R0可操作3D场景，独立自有入口，一怪一招/掉落/采集/有限背包/刷新恢复，交付后新建TEST-D1实机验收。D2加工需要根事务扩展，E同宠双模式另派，均不冒称已实现。

场景接口扩展I-R2：因D发现checkpoint/救援缺口，原DEV实现后另建TEST-I-R2。独立新/旧Node和真实IDB均10/10，实际救援与刷新保留后续根进度；总控核对正式报告、截图、index差异、全部新冻结及主旧版哈希后升级3文件、新增14文件，依赖未覆写。主Node14/14，通过preload只重定向测试证据输出，产品/断言未改。清单INTEGRATED-I-R2.json，72份独立证据归档。D已获通知正式接线；此结论不代替D1真实3D战败救援操作验收。

D1-R1交付审查：47自有+9依赖+版本清单冻结为57文件，全部SHA256及Three三个运行文件验证通过。只读check-evidence断言通过，640/1440最终截图已查看；未计独立验收。全新TEST-D1-R1（01a09529-f3ac-7493-9254-0b338b933119）已正式运行，以独立端口实操战斗/救援/采集/满包/存放拾取/刷新/布局。D1未写入主项目源码，等待其报告。

D1-R1独立结论FAIL已核验：报告SHA、65证据条目及57冻结被测文件一致，查看墙角实机截图并检查model.mjs:116路点反向逻辑。开发10/10、独立Node8/9、实机21/23；F01墙角无法追击阻断，F02空源提示失真。归档66文件，未集成D1源码；已向原DEV下发R2修复及新冻结要求，新版本将新建独立TEST。

DEV-D1-R2已交付并冻结：95自有+9依赖+版本清单共105文件，version-r2.json SHA256 164b845b7a06385bb05641cd87e577a76decab0cc4bd2f1a4248dd397c953dc7。总控全哈希核验、R1的57文件冻结副本及旧证据完整核验、check-r2只读检查通过。开发13/13、旧独立用例开发重放9/9不计独立验收。 已查看原失败站位附近受击截图，开发约3.5厘米坐标差值已明示；不替代独立实机。全新TEST-D1-R2任务01a0954e-85dc-7523-a9fa-bb8bfbcb15ee，工作区C:/Users/HUAWEI/.codex/worktrees/bca0/star-abyss-game，wait_threads确认inProgress。重点独立实操原失败站位附近和墙前中/左右绕障攻击、空源提示与刷新返回重复F，并回归真实战斗/同档救援/满包回滚/存放拾取/完整根刷新及布局。D1仍未集成，等待新独立结论。

TEST-D1-R2独立PASS并完成D1-R2集成：开发Node13/13、旧独立9/9、新独立8/8，主目录重跑30/30；实机矩阵30/30，原生证据20组断言不重复计数。F01墙角追击与F02空源提示在本白盒范围关闭。105冻结文件/测试副本及Three3文件、201证据条目/报告SHA均核验；97个新文件独占写入，9依赖仅检查不覆盖。202份独立证据归档，清单versions/INTEGRATED-D1-R2.json与TEST-D1-R2-EVIDENCE.json。主回归后再次核对全部集成文件和归档证据字节一致（寻路用例会重写path-traces.json，本次确定性输出仍与原SHA相同）。 已阅读完整独立报告并查看墙前左侧受击、空尸提示截图。独立场景入口playable/src/d3-scene/start-r2.cmd（默认127.0.0.1:4182），尚未接原main；营地只存无取，无加工/宠物/自动再生。旧R1入口/verify为历史保留，启动使用R2入口。独立报告reports/TEST-D1-R2.md明确未测精细跨范围/转向/动态遮挡时序、故障注入等，未冒称全覆盖。

设计变更登记：已读取DESIGN_CHANGE_SUPREME_FACTIONS.md与29全章，登记TF01—10、SS01—20、N39—68、个人关系/组织态度分离与ACT01起步边界。设计侧报告图文/审计通过，仅作设计交接，不算运行验收。本次仅更新总控文档，未修改运行代码、交付快照或独立测试报告，未创建额外开发任务。

用户纠偏（2026-09-12，覆盖此前独立白盒产品路线）：唯一产品基线恢复图一原游戏playable/star-abyss.html，4173入口，约6×6公里原地图/角色/载具/星空/调查/旧存档保留。白盒95文件移入artifacts/retired-d1-whitebox/20260912，运行目录d3-scene及对应test已移走，4182无监听；A/B/C/I规则及历史验收档案保留。原main/game.js/资产未更改，主4173 HTTP200。

已新建并确认运行三个分会话：DEV-ORIGINAL-CORE 原游戏玩法接入 01a095eb-c6dc-7bd2-a512-3889505e68a5（a6f0）；DEV-ORIGINAL-WORLD 大地图遭遇与场景 01a095eb-c6de-7f91-a4d9-3d02f79dbd72（93ad）；DEV-ORIGINAL-UI 原游戏HUD与背包 01a095eb-c6e4-7140-baca-8c8870ba29bc（7d07）。接口直接互通并抄总控，所有权/实施合同见ORIGINAL_GAME_REBASE.md。187文件当前原游戏快照ORIGINAL-BASE-R1供隔离开发，禁止从旧Git HEAD误还原。交付分别新建独立TEST，最后再做唯一原入口整合实机测试，通过前不覆盖主bundle。

ORIGINAL-UI阶段状态：7d07初稿Node投影3/3，仅开发中、未冻结/未实机/不集成。上轮Windows Computer Use自动策略因无法可靠识别当前浏览器URL要求停止该轮，开发已遵守，不列产品缺陷。总控核对报告及computer-use SKILL/guidance后发起新一轮，优先使用本轮可用且能识别明确localhost:4196的专用浏览器接口；若仍被停止必须遵守，不换路径规避同轮拦截。待多宽度实机验证、契约统一并冻结后再新建独立TEST。CORE继续逻辑接线但不把初稿当已验收依赖。

ORIGINAL-WORLD阶段更新：开发自报Node5/5，覆盖4路线扫掠、原movePlayer积分、静态LOS与Three权威view/LOD/dispose，localhost4207预览可达；总控未将其计作独立或实机通过。Windows Computer Use上一轮URL识别策略停止，开发遵守。已要求结束受限轮后，在新轮用可识别明确URL的允许浏览器入口继续真实步行/驾车验证；再次停止则遵守，不绕过策略。4处/12源/4敌接口可供CORE开发协作，候选冻结不等于完整交付，主项目暂不集成，后续仍新建独立TEST。

I-R3开发完成已核验冻结47文件（39自有+7依赖+版本清单），version-r3 SHA256 ce42b6d0363105791b0a3a3cae9060221f749b6a7ec8ae7ae4cb51cf1cc742bd；26份R2基线与主依赖/旧证据完整。新独立TEST-I-R3任务01a095f8-627f-73c0-805c-dc0e5c2c57a4（5a02工作区）已运行，验证大世界固定配置贯穿、边界与错配/篡改拒绝、真实IDB原子保存救援和R2回归。主目录仍I-R2，独立通过前不升级。

原游戏并行进度：UI专用IAB恢复成功，已做多宽度真实点击并修Tab冒泡/窄屏提示遮挡，仍待最终冻结；WORLD技术候选保留，新轮已在原月面真实步行，实机继续；CORE定向Node5/5自报，已使用冻结WORLD三源文件作未验收开发依赖，4211隔离预览准备中，未改原bundle。

WORLD开发预览纠正：R1 preview精确匹配game.js遗漏HTML的game.js?v=...，浏览器实际仍载旧bundle。此前4207的原角色/移动截图只能证明原游戏运行，不能证明WORLD挂载，相关新增区域实机结论撤回为待测。R1候选保持原哈希；开发新增preview-r2.cjs/4208重测，需先核实DOM脚本URL、实际bundle及WORLD挂载，再真实到4点并留证。三个源模块据开发报告未因本预览修复变化，CORE可继续未验收开发接线，但其4211也须检查带query的实际加载链。未集成主产品，未独立通过。

ORIGINAL-UI-R1完成开发冻结：总控核验26文件，versionSHA a8f4ab39bb5ef27407756816731c3026095e8bc86163ecdac5c07441634ac714，186原基线文件及主CSS基线一致，查看390最终背包图。新TEST-ORIGINAL-UI-R1任务01a095fa-f3ec-7be0-b62d-dc0d08382faa（1325）运行中，独立验证多宽度/原UI快捷键/长列表/持续update焦点/destroy/请求事件。开发3/3、四宽40按钮命中只是开发证据，未计独立通过。产品只有index.mjs与CSS，fixture/预览不能入真实main；CORE已获冻结源用于未验收开发接线。真实战斗/存档/菜单暂停须最终CORE整合另测。

CORE原入口首次实机记录：4211实际原菜单→V第三人称→T追踪→拖动朝向/原=步行→Z趴下→F回收耦合芯，原玩家约(96,63)。总控已查看a6f0/artifacts/original-core/evidence/02-original-part-recovery.png，原角色/月面/调查与新HUD同屏。新外勤I-R2明确invalidSceneFields、HP未知/保存失败，不算接通。预览query bundle SHA一致。继续可独立进行的原修车/驾驶回归；外勤真实闭环等待I-R3独立放行，主bundle未替换。

I-R3独立PASS并已集成：独立Node9/9、真实IDB12/12、R2真实IDB7/7，真实刷新后整根一致；总控核验报告SHA 44f9031a5f19147d9a98dcea228bb0ccdecdbc0a0d24db39b013523e66cf9ee1及75证据条目、47被测副本哈希。升级前核对主I-R2原SHA，5文件更新/15新增/21保留/7依赖仅校验，旧文件备份总控artifacts/integration-backups/I-R2-before-R3。76证据文件归档，清单INTEGRATED-I-R3.json及TEST-I-R3-EVIDENCE.json。主Node15/15，通过preload仅重定向新测试JSON输出，测试后全部集成文件/证据SHA一致。CORE可按清单接入I-R3继续同原存档实机；此PASS仅同根存储，不代表原大地图/载具/战斗整合完成。

CORE原载具实机边界：原F修车、F上车、V驾驶第一人称已开发实操；CUA即时pressKey的6次W未形成跨帧持续油门，位置约(72,80)、0m/s，不能计真实驾驶通过，也不能据此判产品缺陷。总控查computer-use公开PressKeyInput仅key/window，无hold/duration/keyDown/up接口；禁止杜撰参数或为测试加巡航、dispatchEvent、改坐标。继续可验证操作，真实持续驾驶留待最终联合验收，不以控制器测试替代。I-R3正式放行已重发CORE，非仍等待TEST。

CORE开发实机推进：按主manifest旧新SHA升级I-R3三个产品文件，Node6/6及预览served SHA一致。在4211同旧故事/已修载具档，原玩家实际走到(79,99)，H三次有限矿3→2→1→0、背包铁陨3份；真正刷新继续及重复H后仍包3/源0、提示已采尽。03/04/05原save+根+view证据在a6f0/artifacts/original-core/evidence。此为开发报告，尚未独立验收；继续返营存取、战斗救援及旧故事/载具状态保留检查，主bundle未替换，持续驾驶未通过边界不变。

TEST-ORIGINAL-UI-R1独立FAIL：开发Node3/3、独立Node3/5；短列表四宽40命中通过不代表长内容通过。P2 D1未知null/空字符串投影0/0且缺items误称空库存；P2 D2 390长列表挡原T、附近提示覆盖原HUD；P2 D3仅仓库label更新重建按钮丢焦点。总控核验报告SHA2525a86e36d2858ddee49e8bcb4dcb544c1fb7762b0c0cf9293b24993a23a644、58报告/证据条目及26被测文件，主归档58证据文件及TEST-ORIGINAL-UI-R1-EVIDENCE.json。退原UI开发R2，新冻结后必须新建TEST-ORIGINAL-UI-R2，主UI未集成。B1真实Shift+Tab被原input抢焦点列CORE联合门槛：菜单打开停用原input/暂停战斗、正确恢复，不能用合成DOM反向循环代替实机。CORE可继续其他开发但UI-R1不作为通过依赖。

CORE开发实机发现死亡输入重入：HP0刷新反复input.setEnabled(false)，captureChanged同步refresh形成递归。开发在main改为先置flag再一次性释放，正在同已保存死亡根刷新继续；总控要求补重入/重复refresh/dead-menu-pause/救援失败与再死亡状态回归，不能清档改HP。旧08-player-defeated.json实际HP20/hits5而截图HP0，明确为不同帧不一致记录，保留历史但排除完整死亡根证明；后续提交完成后核对worldId/revision/HP再导出新原生证据。此为开发中缺陷修复，未独立验收、主bundle未改。

CORE开发救援链更新：09正式死亡根HP0/hits6/revision190，10实际救援I提交回(0,190)/HP120，包铁陨2/营地1保留、旧casts均interrupted，真正刷新同档保留；旧08不一致证据继续排除。input control-gate在副作用前缓存目标，Node7/7含同步重入/救援再死亡/20次切屏刷新。实际I→Shift+Tab最后取出→Tab关闭→Return画布，原地图未抢焦点，B1仅记当前CORE开发联合候选。继续击杀掉落/满包边界，UI-R1仍临时失败依赖，待UI-R2新独立验收后再最终整合冻结，未替换主bundle。

UI-R2修复冻结已核验43文件（42条目+版本），versionSHA 27de348c55a7a89ed03f2a179596ea7a8373e102d201fa113b826874e3050574；186原基线及两份R1完整快照/旧证据不变。新独立TEST-ORIGINAL-UI-R2任务01a09614-8b77-7572-b894-f33fa54e6ca8（eead）已运行，针对未知数值/长列表避让/稳定焦点三P2及原UI回归。开发Node9/9/DOM12/12/四宽64命中不计独立验收。CORE获冻结index/CSS可临时联调，主目录未集成UI，最终仍等新TEST和CORE联合实操。CORE新实机自报同旧档原生R击杀怪96→0/玩家120→100、唯一掉落2，11-real-kill原根证据，继续H拾取/刷新及满包回滚。

CORE大地图开发实机进度：原=步行约1.2km至west区，原生R击杀西掠兽96→0/玩家100→80，H拾2血液和3矿后包矿11/血4、35/36kg。再采2kg材料I拒holderOverloaded且源仍3；15-capacity-rejected/16-capacity-retry-rejected原生root JSON.stringify逐字相同，截图说明原物保留/返营。正在同档真实返营存放释放容量再验证恢复；开发证据5组、Node7/7，不计独立通过。UI-R2两产品已与总控冻结核验但仍待独立复验，WORLD足底修正待正式新版本，主bundle未替换。

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
