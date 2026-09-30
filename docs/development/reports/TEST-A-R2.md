# TEST-A-R2 独立战斗数值复测

2026-09-12。**结论：DEV-A-R2 模块复测通过；失败0、阻塞0。** 冻结清单4文件的SHA-256和字节数全部匹配，结束后再次匹配。直接运行冻结开发用例22/22；前轮17项独立用例仅更换导入路径后17/17；本轮新编11组独立边界11/11。F1精度漏杀与F2命中ID别名冲突在本轮复现条件下均修复。仅是纯逻辑模块验收，未接入或验收游戏场景、UI、3D，也未验收跨模块根原子提交。

## 身份和受测版本

- 总控正式ID：`01a094be-fe94-7c23-9b24-13f777c81d8d`。
- 本测试正式ID：`01a094d1-f91b-7b60-b412-5485ee0d15b2`，由进程CODEX_THREAD_ID核实。
- 测试工作区：`C:/Users/HUAWEI/.codex/worktrees/7ab1/star-abyss-game`；detached HEAD；基线全哈希 `5fdb455d3c46601ebd584e64bcf72a2b5c82baf4`。初始git status为空。
- 被测真实冻结根：`C:/Users/HUAWEI/.codex/worktrees/c0e3/star-abyss-game/artifacts/deliveries/DEV-A-R2`。来源开发工作区为 `C:/Users/HUAWEI/.codex/worktrees/2f23/star-abyss-game`；本次未从该可变工作区导入。
- manifest版本DEV-A-R2，冻结时间 `2026-09-12T08:53:02.907Z`；manifest自身SHA-256 `6be4b89aaa8dce8e75df41b1ed873fa6b3eb927f0a7ed952bcc20070cdca9762`。
- 先核对全部manifest条目，再读冻结内置 `docs/development/reports/DEV-A.md`。独立套件直接绝对import该冻结根下 `playable/src/d3-combat/index.mjs`；相对依赖fixed.mjs同样来自R2。没有测默认基线/R1实现，没有调用开发 `--replay-r1` 驱动。
- 已读主项目 `E:/myProject/star-abyss-game/docs/development/CONTROL.md`、cultivation 01/02/19/20/26的公式与边界，及前轮 `C:/Users/HUAWEI/.codex/worktrees/8266/star-abyss-game/docs/development/reports/TEST-A-R1.md`。19章当前241例中间值已更正为291.714133333…。
- 已读实际 `C:/Users/HUAWEI/.codex/AGENTS.md`；检查主项目、测试工作区及其祖先，无其他适用AGENTS文件。codegraph context尝试退出1（工作区未初始化），随后按函数范围读取实现，未建立索引。使用cmd与Node v22.14.0；无依赖安装、收费、密钥、构建、提交或推送。

|冻结根内文件|字节，预期=实际|SHA-256，预期=实际|
|---|---:|---|
|playable/src/d3-combat/fixed.mjs|4008|434e3ace9d094fd4212b38381981c2394cba0b3ebe234706afcc885fb8424f59|
|playable/src/d3-combat/index.mjs|20323|06877a2dd12a0a11a6a7dbf3d2fe4979b8cf28d4f41436255352c806756476d4|
|playable/tests/d3-combat.test.js|26151|c38647421bbe7bf952a1a99818718eebdad9b8218387d32fa14c105d7b22b74b|
|docs/development/reports/DEV-A.md|18611|cf555608d42bdba222be14b2fe9158a68f327c2a42ce7f87e744e5046651adeb|

证据：[执行前核验](../../../artifacts/tests/TEST-A-R2/hash-verification.json)、[执行后核验](../../../artifacts/tests/TEST-A-R2/post-test-hashes.json)、[身份及命令摘要](../../../artifacts/tests/TEST-A-R2/execution-summary.json)。

## 命令、步骤和结果

均在本测试工作区执行，全部真实退出0：

```bat
node artifacts/tests/TEST-A-R2/verify.cjs
node --test artifacts/tests/TEST-A-R2/r1-independent.test.mjs > artifacts/tests/TEST-A-R2/r1-independent.tap 2>&1
node --test artifacts/tests/TEST-A-R2/boundaries.test.mjs > artifacts/tests/TEST-A-R2/boundaries.tap 2>&1
node artifacts/tests/TEST-A-R2/finalize.cjs
```

第一条验证全部清单条目，任何不符退出2，匹配后spawn `node --test <冻结根>/playable/tests/d3-combat.test.js`。最后一条校验TAP计数、核实R1副本只改import，并真实spawn `node artifacts/tests/TEST-A-R2/verify.cjs --post`（退出0）。开发22项、原独立17项、新独立11项，无跳过或取消；计数50/50不代表50项完全无重叠需求。

TAP：[开发22项](../../../artifacts/tests/TEST-A-R2/developer-tests.tap)、[原独立17项](../../../artifacts/tests/TEST-A-R2/r1-independent.tap)、[新边界11组](../../../artifacts/tests/TEST-A-R2/boundaries.tap)。套件：[原独立副本](../../../artifacts/tests/TEST-A-R2/r1-independent.test.mjs)、[新边界](../../../artifacts/tests/TEST-A-R2/boundaries.test.mjs)。逐条断言的expected/actual：[原独立观察](../../../artifacts/tests/TEST-A-R2/independent-observations.json)、[新边界观察](../../../artifacts/tests/TEST-A-R2/boundary-observations.json)。这些JSON含完整原态不变比较，表格为可读摘要。

R1原用例SHA-256 `5d17533d6cfc58aa530f9765b7aacd94bf90ee79a6df9683d6f6685c37b3d959`；本轮副本 `3016be5bce2e0c79cdaef2b61d2fca96607fb1bd8e957a1e3fc2b82cea58e041`。自动字符串比较证明唯一区别为 `deliveries/DEV-A-R1/` → `deliveries/DEV-A-R2/`。观察输出本来相对import.meta.url，因此自然写入自己目录。没有改前轮断言、预期、报告或证据。独立预期由手算、常量及测试侧BigInt构造，不导入fixed算式当预言机，不使用epsilon。

前置工具尝试中一次cmd内联node -e引号解析失败，退出1且未执行脚本；改用自有.cjs后执行成功。部分rg带空格模式的cmd引号解析失败，改用无空格函数模式定位；这不是被测实现失败，也未据此报测试通过。

## 前轮17项逐条复跑

下列各项预期与实际全部一致，均通过；所有原断言保持不变。

|项|独立预期|R2实际|
|---|---|---|
|A01 241管线|raw442.4，总597.24，墙后497.24，Deff120，盾前291.71413333，掉241余.71413333|全部一致，双盾归零，输入不变|
|A02 五阶|伤100/118/140/168/200；盾疗100/110/122/136/150；控制100/105/110/115/120；品质1.28/1.455|全部一致，治疗封顶112.5|
|A03 核心|普通A83.19024/D69.3252/H831.9024；核心A266.208768/D152.51544；实伤66/212|一致；普攻/重击10/18|
|A04 大数|100等级位置按BigInt核对；R9大数乘2/3取整、技能大数快照|全部精确匹配|
|A05 破防/封顶|Deff400，超穿透0，综合保留.15×易伤1.5，掉22余.5|一致|
|A06 混合通道|四通道盾前30/6.66666666/15/30；掉71余.66666666|一致，类型过滤正确|
|A07 多段预算|7.00000001分摊守恒；7伤逐段读档扣7余0|一致|
|A08 快照现态|来源保持旧A，目标新D/新盾；先掉1余.5，后掉1余0，HP998|一致|
|A09 共享墙|首段墙8消耗一次掉12，后段新物盾5及D40掉10|一致|
|A10 死亡幂等|实际掉2，事件一次；死亡后重试无事件；已登记ID冲突拒绝|一致|
|A11 非法输入|标量、权重、消耗、境界、通道、分段、世界、屏障非法均拒绝且原态不变|一致|
|A12 中断离场|起手扣6保留94，中断不退款；目标离场不能命中|一致|
|A13 熟练度|增量0/5/5/0/20/0，总0/5/10/10/30/30|一致|
|A14 F1同分量|整3、两段1.5、三个1伤分量在D80均累计1血|三个1/3准确扣1，HP0，defeated=true|
|A15 F2别名|alias去重后保存返回state，读档改段必须拒绝|拒绝，原态不变|
|A16 F1混合|1/3物理+2/3火术，1HP应死且发1事件|掉1，余0，HP0，事件1|
|A17 F1换防|两段各1，D80→JSON→D20，应0后1并死亡|掉0后1，HP0，事件1|

## 新增独立边界逐条结果

全部通过，详尽值和失败不变比较见boundary-observations.json。

|项|预期|实际|
|---|---|---|
|B01 致死与严格不足|1/3+2/3扣1；火分量减为.99999999后不扣，余149999999/150000000；carry=1−10^-30不提前死|全部一致，无容差|
|B02 同/混合多段换防|首段余1/3；JSON后D/R80→20，第二段扣1，余0，v2，死亡事件1|两种通道配置均一致|
|B03 个人盾跨施放|盾10^-8，先承2×10^-8/3，显示0但剩1/300000000；JSON再施放承10^-8/3恰好清盾|精确余量保留；第二次无生命余数、无扣血|
|B04 个人盾跨三段|盾.5，3伤按.25/.25/.5在D80结算；盾余1/4→0→0，carry0→0→1/2|逐段JSON全部一致，HP10|
|B05 几何盾跨段/施放|盾1/75000000，先吸10^-8，显示0余1/300000000；再吸10^-8，盾0且伤害余1/150000000|跨段、跨施放两种路径均一致|
|B06 非法精确字段|null/数组/空对象/负数/零分母/非字符串/前导0/指数/负分母/显示不符，在carry、个人盾、几何盾均拒绝；存档carry显示不符拒绝|全部抛错，完整原输入/原state不变|
|B07 大整数|N=900719925474099312345679；N/3+2N/3应精确扣N，3N血余2N、carry0|完全一致|
|B08 别名账本|新alias去重返回不同state，旧state不变、HP9、无事件；JSON后改段/目标/施放/屏障均拒绝；同请求继续去重|全部一致|
|B09 死亡后别名|首次死发1事件，alias及其读档重试0事件、HP0；alias改目标拒绝|一致，原态不变|
|B10 版本兼容|v1无exact的.5+.5续算扣1并输出v2；旧.33333333+2/3不足1；v2精确1/3+2/3恰扣1|旧余299999999/300000000，精确版余0，均一致|
|B11 同名盾取高|两个显示0、真实1/400000000与1/300000000的同名盾，应保留后者|精确取高一致|

## API、兼容与接入边界

未修改/新增产品API。测试覆盖主入口现有：masteryMultipliers、passiveMultiplier、computeAttributes、snapshotSkill、effectiveDefense、personalShields、resolveDamage、supportAmount、createCombatState、commitCast、resolveHit、interruptCast、awardPractice；baseResource经属性/施放间接验证。

R2的carryExact/amountExact是生命点单位的十进制整数字符串分数；carry/amount仅为8位向下截断显示。JSON会保留精确字段，调用者必须原样保存，不能把显示0视为盾耗尽。重赋盾值时需同时更新精确字段，或替换为无旧exact的新条目；错误显示与精度组合已实测拒绝。

version1缺少exact的有限小数可续算，产生新状态时输出version2；**旧版已经丢失的有理余数无法恢复，历史漏掉的死亡事件和未登记别名也不能凭空恢复。** B10明确演示旧截断1/3历史与新精确1/3的不同结果，不将兼容描述为历史补偿。R2向旧R1写入器降级不在兼容承诺内。

F2要求调用者保存duplicate分支返回的新state；只看duplicate而忽略state会主动丢掉新别名登记。成功重试返回的result是历史结果，不能再次将其中lifeLoss应用到外部生命；使用返回state和本次events。精度预算/属性/有效防御输入仍遵循8位定点合同；本轮精确验收针对伤害解析、盾及生命余数，不扩大为任意数学表达式输入支持。

尚未完成/不由本报告放行：任意不可信全存档迁移、超长战斗分母增长与账本回收压力；共享几何盾的跨目标权威实体；真实碰撞、帧率、动画、UI/3D、H5场景判定；三清分身与临时生命；库存奖励、世界刷新、根原子快照。未启动假场景。

对其他模块仍假设：适配层以稳定实例ID提供合法命中和defeatEligible，将返回combat state和提交事件原子保存；死亡事件本身不表示物资已发放。总控可据此继续审计拥有文件和接口依赖，再安排集成、联动及真实场景验收，不能据此直接标主游戏已实装。

## 本次改动和交付

仅新增 `artifacts/tests/TEST-A-R2/` 内脚本、TAP、JSON证据，以及本报告 `docs/development/reports/TEST-A-R2.md`。冻结实现、R1证据、主目录均未改。测试完成后向总控发送本报告与50/50结果，停止扩展。
