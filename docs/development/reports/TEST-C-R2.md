# TEST-C-R2 独立功能复测报告

2026-09-12。结论：**DEV-C-R2 模块验收通过；R1 F01 历史片身份复用已修复。未接入场景。** 本会话实际运行冻结 R2：开发用例21/21、前轮独立用例10/10、新编独立边界8/8，合计39/39，无失败、无阻塞。开发 verification 脚本只核验哈希，未执行，不作为独立验收依据。

## 正式任务、工作区与版本

- 测试正式任务：`01a094cc-35eb-7af0-af35-fbdb2a62a21c`（CODEX_THREAD_ID核对）。
- 总控：`01a094be-fe94-7c23-9b24-13f777c81d8d`；开发：`01a094b3-a4b4-7273-a04f-e7ee8518c096`。
- 测试工作区：`C:/Users/HUAWEI/.codex/worktrees/c4d1/star-abyss-game`，detached HEAD，基线完整提交 `5fdb455d3c46601ebd584e64bcf72a2b5c82baf4`，开始时工作区干净。
- 开发源工作区：`C:/Users/HUAWEI/.codex/worktrees/8712/star-abyss-game`。
- 唯一被测版本：`C:/Users/HUAWEI/.codex/worktrees/c0e3/star-abyss-game/artifacts/deliveries/DEV-C-R2`。manifest 的六文件逐一验证SHA-256与字节后，复制至本测试证据目录的 `frozen/` 并再次逐一验证。执行后原件、副本和读取的R1证据全部哈希不变。
- 已读主目录 `E:/myProject/star-abyss-game/docs/development/CONTROL.md`、主cultivation 27全文及08/09/11/26/28相关合同、R2冻结开发报告、R1独立报告/用例/最小复现。27覆盖旧刷新与每角色唯一规则。实际适用AGENTS为 `C:/Users/HUAWEI/.codex/AGENTS.md`；主目录搜索与两工作区向上检查无额外AGENTS。无可用codegraph上下文，采用限定路径读取。

|冻结文件|SHA-256完整内容版本|字节|
|---|---|---|
|playable/src/world-director/definitions.mjs|3d208976f511b0ec4686d725a502f412950fd08593de4a4f9048f99a9ab060ef|1114|
|playable/src/world-director/director.mjs|26110459c1fe4a24da3331e9d006118dfabb451fa8481a9cb7e485495d0cf358|21223|
|playable/src/world-director/rng.mjs|3460f390a4ea4118542788f5afa7407e5746ea2839a47bf32f4040b0e7f8ed02|747|
|playable/src/world-director/verification/replay-r1.cjs|2fc7fd84486c822e019ea3abd489489bf95ae843b1eb8c2df455b6e922d35b6a|2851|
|playable/tests/world-director.test.js|5e1826b057fd9beedcb2a9dad0ae25358c0d3a4038eb3e64acd721ad0c5fc55e|24730|
|docs/development/reports/DEV-C.md|58db20f6847f4270e93b74a3434ea9c46f19040d6db4f688c9c2107faf1f20b8|15282|

## 命令与证据

在上述测试工作区，以cmd与Node v22.14.0运行，无新依赖：

```text
node artifacts/tests/TEST-C-R2/prepare.cjs
node artifacts/tests/TEST-C-R2/run.cjs
```

两条均退出0。runner通过spawnSync真实运行以下Node内置test入口，记录各子进程退出码与完整输出，避免cmd链尾命令掩盖测试失败：

```text
node --test artifacts/tests/TEST-C-R2/frozen/playable/tests/world-director.test.js
node --test artifacts/tests/TEST-C-R2/r1-independent.test.mjs
node --test artifacts/tests/TEST-C-R2/boundaries.test.mjs
```

依次退出0/0/0；测试合计39通过，0失败、0取消、0跳过。前轮independent原文复制后，其相对import自然指向本证据目录的R2 frozen，未改断言。R1原最小复现脚本只读复制留证，未执行其中写R1错误后态的语句；N04独立实现同请求的拒绝及真实存档核对。

所有证据在 `C:/Users/HUAWEI/.codex/worktrees/c4d1/star-abyss-game/artifacts/tests/TEST-C-R2/`：

- `manifest.json`、`hash-verification.json`：来源、六文件全哈希/字节及R1源证据校验值。
- `run-results.json`：实际命令、Node版本、正式任务ID、真实退出码、完整输出及执行后哈希不变确认。
- `developer.tap`、`r1-independent.tap`、`boundaries.tap`：逐项TAP。
- `boundaries.test.mjs`：本会话独立编写的8项边界，不引用开发verification或开发测试辅助函数。
- `boundary-state-evidence.json`：拒绝动作的完整before/after；断言比较完整快照，包含revision、transactions与uniqueLedger。
- `r1-repro-state.json`：前轮真实原始before/after/reloaded的逐字节副本；`real-r1-import-results.json`：原顺序与逆账序六个导入结果。原证据来源为 `C:/Users/HUAWEI/.codex/worktrees/e653/star-abyss-game/artifacts/tests/TEST-C-R1/repro-state.json`。

一次rg通配绝对路径搜索因cmd不展开通配符退出2，随后prepare以Node限定文件名读取相关合同，未用该失败命令作验收依据。无产品测试失败或断言校正后重跑。

## 开发21项逐项复跑

下表D编号对应developer.tap顺序。实际结果均为断言通过，证据为该TAP及冻结开发测试；它们属于回归，独立验收另见I/N表。

|编号|预期|实际及结论|
|---|---|---|
|D01|固定RNG向量可复核，指纹排除ID/品质而包含实际组合|匹配，通过|
|D02|首次一次；等待/暂停/重载/离线不替换未消耗物|同代保留，通过|
|D03|部分采集保留；失败/未提交无令牌|原态/无令牌，通过|
|D04|提交耗尽→一令牌→冷却→安全预留→不同新代；重载事件重试不增发|各阶段匹配，通过|
|D05|最后怪物才冷却；成员重复不增令牌；掉落容器上限局部生效|匹配，通过|
|D06|无不同组合等待且不重抽品质|等待，通过|
|D07|96小时离线最多1800秒/一代，不生成/重复重叠时间|匹配，通过|
|D08|预留读档保留；提交复检安全；写失败回滚|匹配，通过|
|D09|篡改计划、过期版本、改事务载荷、时钟倒退拒绝|均拒绝，通过|
|D10|每项必需空间查询缺失/不安全阻止|均阻止，通过，仅查询合同|
|D11|MYF/MYW批量锁；其他来源拒绝；流转/退役不释放|匹配，通过|
|D12|完整原片只重铸原身份；旧并发持有版本拒绝|匹配，通过|
|D13|批量冲突和存储抛错不留部分键|无残留，通过|
|D14|旧规则实例保留；锚点顺序不扰随机流|匹配，通过|
|D15|坏档及重复唯一身份拒绝，不替换输入存档|匹配，通过|
|D16|耗尽保存失败保留原资源；恢复后同请求恰好一令牌|匹配，通过|
|D17|预留位置不可移动；新代写失败不烧令牌|匹配，通过|
|D18|100代相邻组合不同、100令牌、成员掉落身份读档一致|匹配，通过|
|D19|关闭离线资格无抵扣；区间不可存给未来耗尽|匹配，通过|
|D20|当前/历史片不可预留作另一原器或root|拒绝，通过|
|D21|导入跨账当前/历史身份冲突拒绝且输入不变|匹配，通过|

## 前轮独立10项对R2逐项复跑

|编号|操作与预期|实际及结论|
|---|---|---|
|I01|未采7200秒、部分至1、离线96小时及JSON重载；未提交耗尽拒绝|同实例/剩1/无令牌/0抵扣；拒绝且全态不变，通过|
|I02|91秒耗尽；dueAt−0.001阻止、dueAt预留；重载提交重试；旧实例晚事件|精确边界/新ID不同指纹/一令牌；重试不变/旧实例拒绝，通过|
|I03|8项安全标志false/缺失，44.999米、可见非法入场、3容器、移位置|全部阻止且保留预留；45米/合法入场/2容器允许，通过，仅查询合同|
|I04|第一成员合法迁出其余击败；逐事件重放|仅最后给令牌；剩0且不重复，通过|
|I05|候选只有ID/品质/权重不同|noDistinctCandidate，计划只读，通过|
|I06|离线跨代与区间改ID/重叠；同令牌多区间|100/0/0/50秒且后续不累加，通过|
|I07|false/抛错注入预留、部分、耗尽、离线、显示、唯一预留/显现|每次全快照不变，通过|
|I08|第二唯一键冲突；玩家A→NPC→托管→玩家B→退役→重载|批量不留MYF；原item/root保持且不释放，通过|
|I09|拆3片、缺片/重复/外来片重铸；完整逆序；重复及旧片复用|非法均拒绝/原态不变；合法恢复原身份，通过|
|I10|重铸后JSON重载，历史f1作为另一唯一原器item|uniqueIdentityConflict且全态不变，**通过，R1 F01关闭**|

## 新编独立8项边界

|编号|操作与预期|实际及结论|
|---|---|---|
|N01|3个历史片分别作item/root，连续3轮JSON重载；每次拒绝且不调用持久化|18次全部uniqueIdentityConflict、全态不变、无额外persist调用，通过|
|N02|批量MYF+MYW，历史片作item/root；冲突项前后两顺序；失败重载原请求；同失败事务改合法身份重试|四组合无部分键/事务；失败重试仍拒绝；纠正后两键同时成功，成功重放不变，通过|
|N03|空账一次3键，第三项item/root碰第二项root|两种均拒绝，persist调用0，空账完整保留，通过|
|N04|核实R1真实before原器及after复用old-fragment-1，确认after=reloaded；before重新触发F01；三态原/逆账序导入|before两序接受；其上复用拒绝且不变；after/reloaded两序均uniqueLedgerConflict；六次输入不变，通过|
|N05|合法当前片重载/同事务重放；NPC/托管/换角色；原片逆序重铸及重试；新一轮用新片再重铸|原item/root保留；同片在拆片和重铸两次历史引用合法；所有成功重试不改变状态；两轮历史片继续锁定，通过|
|N06|缺片、重复片、外来片；重铸后本原器复用历史片及另一原器拆出该历史片|全部对应missingOriginalFragments/fragmentIdentityConflict，全快照不变，通过|
|N07|false与抛错分别注入双键预留、拆片、重铸；失败后JSON重载再用同请求恢复并重试|6组合均全回滚；恢复后恰好成功一次；成功重放无变化，通过|
|N08|历史fragmentIds为字符串/null/对象/空串成员/数值成员；其他条目item/root/当前片/历史片与旧片冲突|5形状错误invalidUniqueSave；4跨账冲突uniqueLedgerConflict；所有输入不变，通过|

## 场景边界、API与下一步

产品导出仍是createDirector/validateDefinitions、sampleDefinitions及RNG_VERSION/seed32/randomUnit/fingerprint；实例覆盖planTick、reservePlan、commitPlan、consumeCommitted、recordResourceRemaining、applyOfflineEligibility、acknowledgeView、reserveUnique、transitionUnique、serializeDirector、explainAnchor。没有新增产品API。测试只新增本报告及指定 `artifacts/tests/TEST-C-R2/` 下用例、证据和核验副本。

本轮确认世界刷新与唯一账的同步纯逻辑状态机，及F01的运行时/真实旧档拒绝行为。错误旧档被拒绝而不静默修复，不意味着已提供迁移工具。空间夹具为注入查询合同，唯一测试空anchors无需空间生成；这些不是3D场景证据。未做实际45米/80米/20米空间测量、视线/载具路径/地形预算、真实掉落清单保留与拾取、库存容量/钱货/原片扣除、战斗死亡可信事件、NPC抢夺、机会候选池/概率/首次调查、跨A/B/C原子保存、存储CAS并发或磁盘崩溃恢复验收。

依赖假设：库存/战斗仅在真实成功后发committed事件；同世界角色共享同一账；宿主正确计算空间与其他预留占用；同步persist真实返回成功。单模块批量预留原子不能代替跨模块原子协调，多director副本不能代替持久层锁。

总控下一步可审计并集成此次冻结的产品模块与测试，再独立安排A/B/C真实事件和同快照联动验证；之后接一处草、一组怪及真实空间查询并实际操作验收。verification仅开发辅助脚本，不能作产品接口或代替场景验收。未改被测实现/主目录/R1工作区，未构建、未收费生成、未读取输出密钥、未提交推送。报告发送总控后停止扩展。
