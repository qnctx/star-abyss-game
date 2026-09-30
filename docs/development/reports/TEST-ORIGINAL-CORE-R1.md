# TEST-ORIGINAL-CORE-R1

结论：**FAIL（B1 动态载具阻挡未接通）**。受测范围为原游戏上已实现的 CORE-R1 闭环，不代表全部设计完成。仅独立测试，不修产品；未提交、未改主目录或冻结版本。发现阻断后按主控要求继续必要战斗/救援检查，再停止本候选验收，未切换 R2。

受测 CORE version SHA256 `7c71f1c06861cf198c09aaea7f2ba3704a83e7c0c77a4edbe515fbaf5911d449`。控制冻结根为 c0e3/artifacts/deliveries；独立树在本工作树 artifacts/tests/TEST-ORIGINAL-CORE-R1/tree。已核验 ORIGINAL-BASE-R1 187、I-R3 47、UI-R3 45、WORLD-R3 19、CORE-R1 80 文件。187 基线仅 main/CSS/I 三文件共5预期差异；原 game.js 未改。

阻断 B1（高优先级，CORE 所有权）：WORLD `playable/src/expedition-world/queries.mjs:40` 的 createWorldQueries 返回 Object.freeze 对象，CORE `playable/src/main.mjs:110` 追加 dynamicBlocked 失败。当前实际提供的 IIFE 中静默丢失；严格模式同赋值抛 `TypeError: Cannot add property dynamicBlocked, object is not extensible`。运行时 `expedition-runtime/index.mjs:32` 的 clear 与 `:57` 的 spatialQuery 使用可选调用，缺函数时放行。使用冻结原 createMobility 得到原载具 (72,80)，其 groundMobilityBlocked=true，但 WORLD staticCanOccupy=true、CORE 实际 clear/spatialQuery 表达式均给 true（可通行/可生成）。因此原接入合同要求的动态载具护栏未成立，不能整合通过。证据 dynamic-adapter-result.json、dynamic-adapter.tap、strict-adapter-result.json。这里是独立冻结模块接线/消费者检查，不冒充浏览器驾车或AI穿车录像。保持 WORLD 不可变接口，在 CORE 组合适配是修复建议；本测试未实施。

已完成实机：原 V/T/拖动/=、F 回收芯/修车/上下车/刷新兼容；H 三份采尽与重复/刷新无复制；营地逐存空/逐取空，最后项 pending 后焦点回 enabled 关闭按钮；Shift+Tab/Tab/Return 关闭回 CANVAS；开包 pose/HP/simTime/完整根不变；敌96→63，玩家受击死亡、真实救援/同档reload保留敌伤/包仓/耗尽/车辆，旧cast中断。

本次较大 DOM 返回存在截断，08/14/15/16旧文件保留但不能用于完整根对比。已重新实玩第二次死亡救援，以19/21/22分段保存、JSON解析成功的完整根验证通过。

辅助逻辑：新增5独立边界通过；原墙/岩/关门拒绝LOS与开门通行独立静态检查通过；原7/41仅回归。所有 fixture 都不计实玩。

未完设计：负重 moveMultiplier/staminaMultiplier 已由库存计算，但 main 仅消费动作许可，没有接连续移速/体耗。本轮原接入合同没有明确承诺这两倍率，开发报告也明确未实现；按主控指令单列设计未完项，不声称全部D3-10/13完成。

实际击杀补验：原生 R 两次将同一受伤掠兽 63→30→0，玩家最终20 HP。只生成一个对应实例遗留物、数量2；H 两次得到血液2，遗留物0。重复 H、R 再刷新继续/H 后仍血液2、矿2、仓矿1，同 worldId，敌未复活。24—27完整根、25/29截图支持。之前背对敌人的 R 实际落空，转身后才命中；HUD 出现冷却禁用。未通过脚本改朝向、血量、实例、位置或模拟时间。

## 实机范围与复现

自有 `http://127.0.0.1:4297/playable/star-abyss.html?expeditionDebug=1`，使用 computer-use 技能与专用 mcp__cua_repl IAB。原 preload 仅把监听4211映射4297；产品预览脚本原字节不改。页面实际脚本URL `./game.js?v=c2-idle-fix-20260909`，HTTP字节与独立构建均 SHA256 `b4c1472dcefa59530f8e5adfb910f506737ad1b6d0d0d38a9ed85ee95e389255`。不能仅以旧查询串判断加载旧包；本次按HTTP字节核验。真实expedition-evidence DOM根与HUD库存、原场景挂载一同出现。禁止性测试hook未启用，未dispatchEvent/私有CDP/内部advance/写根。

| 检查 | 本版结论与证据 |
| --- | --- |
| 原6km世界、角色、星空、载具 | 实际原入口，02/29/31截图；187基线确认原game.js、scene/input/avatar/HTML未改。没有小白盒替代入口 |
| 原移动、拖动、V、T、F修车上下车 | 实玩通过。回收芯在约(97,62)，修车于(73,79)，上下车/驾驶第一人称，03/04保存兼容。持续驾驶不计通过 |
| 有限采集/入包/重复与刷新 | 实玩通过。05—07，矿簇generation0 3→0，包3，重复不复制 |
| 营地存取、最后项移除、pending后焦点 | 实玩通过。09/10及原生操作记录（08截断不用）；包3→0/仓0→3→0/包3；每次提交后焦点回enabled关闭BUTTON |
| Shift+Tab/Tab/Return与原控制门 | 实玩通过。原生键盘取物、循环至关闭、Return回CANVAS#world；后续真实行走、V/J/M继续。11/12开包完整根/pose/HP/simTime相等 |
| 实际受伤/死亡/救援/同档刷新 | 实玩通过。18/19/21/22完整根：玩家120→0→120；敌仍63，包2/仓1，generation0矿耗尽，原已修车/记录保持；旧cast全interrupted |
| 实际击杀/唯一掉落/重复/reload | 实玩通过。24—27完整根及29稳定尸体；唯一掉落2→0、包血液2，重复不复制 |
| WORLD真实AI | 原场景追击位置改变，23 root记录真实windup，实际攻击每次20及死亡；29尸体稳定且reload保留。前摇截图包含菜单遮挡，不扩大为全套动画质量验收 |
| 原墙/岩/门LOS | 独立静态冻结几何测试通过，非实机对墙战斗：闭门/墙/岩拒绝，开门通过。未扩大为实际AI沿墙绕门通过 |
| 容量/负重拒绝→卸货→同源再采→再拒绝 | 新增runtime fixture完整根验证通过；本版浏览器未走到超限，**未作实机通过** |
| 原故事与设施 | 真实修车支线、J记录/原M地图保留；未走完求救信号/舰内全任务，未把全故事验收通过 |

复现实机主路径：开始调查→V/T/拖动/=→原F取芯/修车/上下车→I并reload继续→原行走到(80,100)→H逐份采尽→重复与reload→正常绕岩返营→I逐存/逐取/焦点循环→原行走接敌，背对R落空、转身R敌伤→真实死亡/救援/reload→再次死亡/救援/reload留完整根→重新正常行走接战，两R击杀→H取尽→重复/reload→J与6km M全图。途中原岩体真实阻挡、多次绕路，不改位置快进。

## 辅助逻辑、证据可靠性和未测

`node --test artifacts/tests/TEST-ORIGINAL-CORE-R1/independent-boundaries.test.cjs`：5/5。fixture包含同步回调改变menu时重入、1000米以上AI追击坐标及pitch1.35、并发采收只提交一次与CAS拒绝完整根不变、36kg上限拒绝及同源释放恢复、真实逻辑死亡根与旧link救援收据补偿一次。采用内存storage和模拟context，只证明逻辑边界；补偿测试模拟旧link未持久化结果，没有在浏览器注入localStorage失败。原生浏览器IDB操作由本版实玩证明正常路径。

`node --test .../static-los.test.cjs`：1/1，真实冻结原墙/岩/门几何。`dynamic-adapter.test.cjs`：0/1，B1预期失败证据。`strict-adapter.cjs`补充严格赋值区别。旧CORE 7/7、原input/session41/41是回归，输出各自tap；旧scene-node-r2.json测试副作用另存后按原SHA恢复。`node .../audit-live.cjs`：6/6，使用本次完整原始根，不使用开发旧截图/旧报告当证据。

08/14/15/16原始文件因单次DOM返回截断无效，清单validJson=false；不删除或补造缺尾。重新发生的第二次死亡/救援以19/21/22完整分段根取代。分段只读同一暂停/死亡DOM节点，每段50000字符，保存后JSON.parse验证；脚本逻辑见本任务CUA记录。各文件SHA、字节数与角色在evidence-manifest.json。全部证据均本版操作，开发历史证据只读未混入独立树。

明确未测：持续驾驶（CUA仅即时pressKey，无文档化hold/down/up）、浏览器超限完整闭环、第二处远距离遭遇、原完整故事/舰内设施、实际AI沿墙岩门寻路及动态车碰撞/LOS、不同viewport响应式和真实冲刺体耗。容量完整闭环只在辅助fixture通过；不将未测项写成PASS。本候选已确认B1，主控已退开发R2，后续必须另建新独立验收，不能用本测试覆盖修复版。

负重倍率的依据为主docs/cultivation/10_STORAGE_AND_ENCUMBRANCE.md第3/9节与13_MOVEMENT_AND_PURSUIT.md设计规格；主docs/development/ORIGINAL_GAME_REBASE.md本轮明确核心接战斗、有限包与原保存，但没有明确连续倍率承诺，DEV-ORIGINAL-CORE.md切片2明确未接。故作为已确认设计未完项单列，并限制本结论，不额外伪称所有设计完成。

## 清理与交付

已关闭自有IAB测试页，未设置viewport override，无需恢复覆盖尺寸。自有服务session19038已Ctrl+C结束，netstat筛选4297无连接/监听。主目录、冻结及产品均未改，无提交。最终全冻结清单与独立树原始文件逐SHA复核见final-integrity.json；报告与清单SHA见delivery-sha.json。可审交付：本报告、artifacts/tests/TEST-ORIGINAL-CORE-R1/evidence-manifest.json及列出的独立脚本/完整根/截图/日志。
