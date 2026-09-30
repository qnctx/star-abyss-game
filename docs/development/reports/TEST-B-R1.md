# TEST-B-R1 独立库存事务验收

2026-09-12。结论：**通过——DEV-B-R1 模块通过，未接入场景。** 开发测试复跑 17/17；本会话新编独立测试 13/13，失败 0、跳过 0、阻塞 0。未连接浏览器，没有验证可操作游戏场景、浏览器存档或跨模块原子性。

## 身份、范围与基准

- 正式总控任务：`01a094be-fe94-7c23-9b24-13f777c81d8d`。
- 独立测试任务：`01a094c1-f134-7d81-926b-34c8a88a27ec`。
- 测试工作区：`C:/Users/HUAWEI/.codex/worktrees/118a/star-abyss-game`；detached HEAD，`5fdb455d3c46601ebd584e64bcf72a2b5c82baf4`，开始时 git status 干净。
- 开发原工作区：`C:/Users/HUAWEI/.codex/worktrees/bb9f/star-abyss-game`。
- 唯一被测冻结目录：`C:/Users/HUAWEI/.codex/worktrees/c0e3/star-abyss-game/artifacts/deliveries/DEV-B-R1`。独立用例使用绝对 file URL 直接 import 冻结实现；开发测试也直接执行冻结目录文件，未使用本工作区默认基线实现。
- 已读取主项目 `E:/myProject/star-abyss-game/docs/development/CONTROL.md`、cultivation README 与 03/10/12/27/28，以及开发原工作区 `docs/development/reports/DEV-B.md`。27 对消耗起点和唯一性的修订优先于旧过期规则。
- 已读取实际 `C:/Users/HUAWEI/.codex/AGENTS.md`；所检查主项目/测试目录及祖先没有其他适用 AGENTS.md。CodeGraph context 报未初始化，未创建索引，转局部读取冻结模块。
- 仅写本工作区 `artifacts/tests/TEST-B-R1/` 和本报告。未修改冻结文件、开发实现、主项目、game.js；未构建、提交、推送、生成收费资产或读取密钥。

## 冻结文件核验

执行任何被测代码前，按 manifest.json 对原始字节核验 SHA-256 与长度，两项一致；测试结束再次核验仍一致。证据：`artifacts/tests/TEST-B-R1/hash-verification.json`，包含完整清单、期望及实测哈希。

|冻结相对路径|字节|SHA-256|
|---|---:|---|
|playable/src/d3-inventory/index.mjs|16259|`3a63f4cc0278ef1ed9e4e6dd8526a4530bab8fb3fe05796f0dfde49c370dd566`|
|playable/tests/d3-inventory.test.js|16816|`c842c7b1923370ee3d6307fefd457a9c2843642f7afe65ac4feab5b8b956ede5`|

## 执行命令与复核步骤

环境 Windows，cmd，Node v22.14.0，Node 内置 test，无新增依赖。以下命令在测试工作区运行，先核验再执行；TAP 各自记录 17/17 和 13/13。

```bat
node artifacts/tests/TEST-B-R1/verify.cjs
node --test C:/Users/HUAWEI/.codex/worktrees/c0e3/star-abyss-game/artifacts/deliveries/DEV-B-R1/playable/tests/d3-inventory.test.js > artifacts/tests/TEST-B-R1/developer-tests.tap 2>&1
node --test artifacts/tests/TEST-B-R1/independent.test.mjs > artifacts/tests/TEST-B-R1/independent-tests.tap 2>&1
node artifacts/tests/TEST-B-R1/verify.cjs
```

最初一次内联 `node -e` 核验命令因 cmd 引号传递报 SyntaxError，尚未执行被测模块；随后改用留存的 verify.cjs 成功核验。该准备命令错误不是被测实现失败。重跑时检查 Node 命令退出码及 TAP 汇总，不将后接 type 命令的退出码冒充测试退出码。

## 独立验证方法与逐项结果

独立测试未导入开发测试辅助函数。自建内存 CAS 使用 JSON 字符串保存权威快照，每次读取都通过真实 deserializeState 重载。CAS 检查 worldId/revision、快照 revision 递增、收据和 outbox 后才写入；支持返回 false、写前抛错、写后响应丢失三种故障，并统计调用和实际写入次数。它不是永远返回 true 的假存储，也不是跨进程/磁盘持久存储。

下表 ID 与独立 TAP 测试名称对应；B01 参数化为三个测试，合计 13 项。

|ID / 操作步骤|预期|实际|
|---|---|---|
|B01-slots：两种品质各一份，向一格包连续转移|第二笔导致全事务拒绝，源/目标/事件/存储不变|slotsFull；输入快照与权威存储逐字节不变；CAS 0 次|
|B01-volume：两份共14ml，目标13ml|体积先满，整批不扣料|volumeFull；快照/存储不变；CAS 0 次|
|B01-mass：两份共22g，目标21g|内部质量先满，整批不扣料|massFull；快照/存储不变；CAS 0 次|
|B02：矿合入已有堆，再加入占两格的蛋|刚好3格/8021ml/3033g通过；合堆仅省格|实测精确匹配，已有矿堆数量3|
|B03：负重60/80/100/110/120/121%，再测试119→120→121g|速度1/.875/.75/.625/.5/0；超过100%禁疾跑/闪避/起飞；120+1拒绝；被动超载可卸货|全部匹配；holderOverloaded 拒绝新增1g；降低安全负重后卸载成功|
|B04：9007199254740993g配1ppm戒指，另加1g配2%袋和外壳|大整数无损，按容器传重向上取整，外壳只计一次|质量字符串精确保留，角色重量符合独立 BigInt 算式，存档往返相同|
|B05：17份拆7份，向19/18份两个堆分配，再24轮搬运|各堆最多20；拆分ID可追溯；总数/体积/质量/各来源数量守恒|两旧堆均20；rootItemId保留；每轮与初始独立聚合账一致|
|B06：唯一物玩家→NPC→地面→仓库→玩家，每步重载，再尝试消耗|始终一个原ID/uniqueDefinitionId/rootArtifactId；不产生再生事件；拒绝消耗|四次转移均匹配；outbox=0；uniqueConsumptionRequiresCoordinator|
|B07：矿与伴生石分别采收，预览最终石，再提交、加工矿、重放旧采收|矿取尽仍无事件；最后一类取尽才有一次提交事件；后续重放保留当前态|预览 committed=false；提交 true 且depleted；加工不新增空缺；旧请求重放events=[]，revision=3，矿仅剩1，outbox=1|
|B08：取消预览，CAS false，写前异常，授权拒绝，再正常提交同计划|前三种失败与取消不扣料、不发事件；允许正常重试|原权威JSON始终不变；正常重试仅写入1次且事件1条|
|B09：玩家/NPC基于同版本并发争采最后2份|只能一方成功，另一方CAS拒绝；重载后旧版本也拒绝|1 fulfilled、1 commitRejected；实际写1次、数量2、事件1；旧请求revisionConflict|
|B10：最后采收已写入但响应抛错，重载并重放原请求，再改量复用ID|权威态已提交；重放不再调用CAS、不重复物资或事件；改量拒绝|原调用方revision=0、存储=1；重放replayed=true/events=[]；CAS/写入各1；transactionIdConflict|
|B11：两个满格容器同事务换物，再伪造空预览转入满包|按最终态允许换物；提交重算容量而非相信预览|换物成功；伪造预览提交slotsFull且存储不变|

开发测试单独复跑的 17 项覆盖其自报边界，包括品质/T/状态属性合堆差异、访问限制、唯一冲突、部分采集、并发及异步授权快照稳定。该结果仅是复跑证据，独立验收依据还包括上表新编操作与断言。

## 失败复现、证据与交付文件

本轮没有发现被测模块失败，无实现缺陷最小复现需要退回；所有预期故障在独立文件中保留可重跑。若未来同版本重跑失败，应保留对应 B 编号、TAP 与原文件哈希，退回总控安排开发修复，测试会话不修改实现。

- `artifacts/tests/TEST-B-R1/verify.cjs`：冻结字节核验程序。
- `artifacts/tests/TEST-B-R1/hash-verification.json`：清单与实测哈希。
- `artifacts/tests/TEST-B-R1/independent.test.mjs`：独立用例、真实内存CAS及故障注入。
- `artifacts/tests/TEST-B-R1/developer-tests.tap`：冻结开发测试原始输出，17通过。
- `artifacts/tests/TEST-B-R1/independent-tests.tap`：独立测试原始输出，13通过。
- `docs/development/reports/TEST-B-R1.md`：本报告；无产品 API 改动。

被测 API：InventoryError、createState、validateState、measureContainer、measureHolder、planTransaction、commitTransaction、serializeState、deserializeState；独立用例通过创建、序列化、计划、提交间接执行 validateState。未新增产品导出API。

## 未覆盖边界与接入假设

本轮仅验冻结库存事务模块，不将各章全部规则视作已完成。未验证：浏览器/IndexedDB真实持久存档及断电、跨标签页/跨进程并发、DEV-C消费确认与outbox压缩、库存与世界唯一账同根快照原子协调、坏档修复/迁移、唯一原器拆片重铸、金钱/炼丹订单、袋戒绑定/容器嵌套生命周期、服药动画锁定与效果原子扣料、载具距离与飞行中权限、NPC真实AI搜夺/销赃/死亡、UI与中文布局、游戏输入兼容、长时间性能和海量收据。

模块级假设：调用方提供真实容量/堆叠参数、稳定资源实例ID和合法容器持有关系；访问距离/药效条件由authorize及接入层判断；compareAndSwap必须原子保存快照+收据+outbox，异常后读取权威快照再用完整原请求重放。模块返回的事件不是已经被世界模块消费的证明，唯一物局部不重复不是世界资格已锁定的证明。

交回总控：可进入所拥有文件的集成审计；下一步应另建联动测试，验证库存、世界空缺与唯一账同一根存档提交及失败恢复，再接真实采集/双栏转移场景并进行浏览器操作验收。本测试至此结束，不继续扩展。
