# DEV-C-R2 世界刷新模块修复交付

2026-09-12。状态：**DEV-C-R2 仅修复 TEST-C-R1 的 F01；开发者自测21/21通过，开发复跑R1用例10/10通过，等待全新独立 TEST-C-R2。尚未通过最终模块验收，未接入主游戏。实现重新冻结。**

总控迁移确认：当前总控任务为 `01a094be-fe94-7c23-9b24-13f777c81d8d`，权威主目录仍为 `E:/myProject/star-abyss-game`。本次仅修正自测与最终验收的状态文案，代码和测试保持冻结；不自行集成或扩展，收到独立失败报告后才按授权修复，每轮由新建独立复测任务验证。后续交付向新总控提供本 DEV 报告。

## R2：F01 定向修复及开发复测

本节为收到独立失败报告后的新一轮授权修复；上文总控迁移确认是上一轮记录。只读了 `C:/Users/HUAWEI/.codex/worktrees/e653/star-abyss-game/docs/development/reports/TEST-C-R1.md` 和其 `artifacts/tests/TEST-C-R1/` 中独立用例、最小复现及实际错误快照。未修改冻结 DEV-C-R1、测试会话文件或主项目。

F01 原因：重铸清空当前 fragments 后，历史片仅在 history 中。reserveUnique 与 validateSave 只检查当前 item/root/fragments，遗漏历史片；已有 fragment 分支却检查历史，导致入口约束不一致。

修复：新增内部 `uniqueIdentities`，统一收集 itemInstanceId、rootArtifactId、当前 fragments 及 history.fragmentIds。唯一预留、拆片和导入校验共用该集合，历史片不可成为任何其他唯一条目的原器、根或片身份。单条原器的拆片/重铸历史允许重复引用同一片（Set 在条目内去重），条目间碰撞报错。历史片字段导入时检查数组/字符串形状，不默默遗漏。没有新增产品API、存档字段或迁移，合法旧档直接兼容；已含冲突的旧档拒绝导入并保持输入原样，不自动删除实物。

相对 R1 本轮改动仅四个文件：

- `playable/src/world-director/director.mjs`：上述身份检查修复。
- `playable/tests/world-director.test.js`：保留原19项，新增2项F01回归；覆盖当前/历史片占原器及root、失败原态不变、失败重试、批量后项冲突全回滚、合法转移/成功事务重放、同原器历史重复引用、导入当前/历史交叉碰撞和账本顺序变化。
- `playable/src/world-director/verification/replay-r1.cjs`：仅开发验证脚本，读取指定R1证据路径，在内存改import目标为当前实现后运行原独立用例；最小复现的写证据调用只在内存替换为console.log，避免任何结果写回R1。脚本还导入R1真实错误快照并检查前态合法、错误后态拒绝及输入不变；运行前后核对三个R1脚本/证据SHA-256不变。不是游戏依赖。
- `docs/development/reports/DEV-C.md`：本次交付记录。definitions.mjs、rng.mjs 未修改。

真实命令与结果（cmd，当前 DEV-C 工作区）：

```text
node --test playable/tests/world-director.test.js
node playable/src/world-director/verification/replay-r1.cjs C:/Users/HUAWEI/.codex/worktrees/e653/star-abyss-game/artifacts/tests/TEST-C-R1
```

第一条退出0：21 tests / 21 pass / 0 fail，约1.17秒。第二条退出0：原R1独立用例10/10通过；最小复现子进程退出1并精确匹配 `Error: uniqueIdentityConflict`（原脚本无catch，此处退出1代表在禁止的预留处被拒绝，wrapper验证后退出0）；没有到达写证据语句。R1 `repro-state.json` 的 before 正常重载，after 与 reloaded 均报 `uniqueLedgerConflict`，输入对象不变，读取的源脚本和证据哈希未变。

两次早期 `node -e` 调用因cmd引号解析在脚本启动前SyntaxError退出1，未作为复测依据；随后保存以上只读复跑脚本并成功执行。没有重跑会写R1证据的原run.cjs/prepare.cjs，也未覆写其日志。

这些结果是**开发自测与开发复跑独立用例**，不替代新独立 TEST-C-R2 的验收。完整交付现共六个文件（原三个产品模块、一份开发测试、本次只读复跑脚本、本报告）。本轮完成后重新冻结，待新总控安排独立复测；无提交、推送、集成或场景扩展。

## 工作区与所有权

- DEV-C 正式任务 ID：`01a094b3-a4b4-7273-a04f-e7ee8518c096`（通过当前任务 CODEX_THREAD_ID 核对）。
- 工作区：`C:/Users/HUAWEI/.codex/worktrees/8712/star-abyss-game`。
- 分支：`HEAD`（创建任务提供的独立工作区为 detached HEAD；未创建分支、未提交、未推送）。
- 基线提交：`5fdb455d3c46601ebd584e64bcf72a2b5c82baf4`。
- 规格来源：只读 `E:/myProject/star-abyss-game/docs/development/CONTROL.md` 及该主项目 `docs/cultivation/08、09、11、26、27、28` 对应全文；27 消耗空缺与世界唯一优先。未使用工作区旧稿覆盖主项目。
- 完整交付文件：`playable/src/world-director/director.mjs`、`definitions.mjs`、`rng.mjs`、`verification/replay-r1.cjs`，`playable/tests/world-director.test.js`，本报告。
- 未改主入口、公共资产、package.json、打包产物或其他任务。所有命令使用 cmd，无收费生成。CodeGraph context 返回当前工作区未初始化，随后采用限定路径检查。

## 已完成切片

一个普通基础草资源锚点（3/4 份两套布局）与一个 M00 普通怪群锚点（2/3 只、不同入口/巡线/外观）。候选位置是逻辑 ID，由未来场景适配器提供真实坐标，不冒充已标定地形。

初始布置独立于换代。之后只有已提交 depletion 或最后一名怪物死亡/合法人口迁出才产生一次令牌；冷却从消耗提交时开始，间隔在该代创建时固定。部分采集只减少当前剩余量，不生成空缺。组合指纹包含家族、数量、布局、路线、外观、伴生物，排除 ID/时间/品质；无不同组合返回 `noDistinctCandidate`。

计划读取不改状态、不发奖励。预留锁定计划、位置与下一代；提交再检查空间和预算，成功快照同时登记新实例、旧实例历史、已使用令牌与清除预留。写入适配器失败时保留原内存状态，失败事务不进入去重表。模型确认独立，实例创建默认 `viewAcknowledged:false`。

普通槽位离线最多一次 1800 秒抵扣，只影响已耗尽的一代；不实际生成、不采集、不清掉落。区间 ID 去重加 wallTime 高水位，改 intervalId 也不能重用相同/重叠时间。无空缺不能储存抵扣给未来消耗；同令牌不会跨多次离线累加。

唯一账按世界根保存。`reserveUnique` 一次可占 MYF 与对应 MYW/MYC/MYP 两个键，重复事务返回原结果，其他来源或角色不能再占。显现、领取、转移、托管、吸收、拆片/重铸、退役保留原 itemInstanceId/rootArtifactId。退役为终态，未提供释放唯一键的入口。重铸要求完整原片集合；不允许用同组碎片再次重铸，碎片 ID 不可重新用于下一次拆分。实际物品移动/片库存扣除归库存模块，世界账仅记录资格和身份。

## 导出 API 与调用约定

`director.mjs` 导出 `validateDefinitions(definitions)`、`createDirector(options)`。

`createDirector({ definitions, worldId, worldSeed, savedState?, clock, spatialQuery, random?, persist? })`：

- `clock()` 为秒单位有效游玩时钟；暂停时不推进。重载时必须恢复与快照相容的 simTime，不能从零开始。拒绝低于已提交高水位的时间。
- `random(parts)` 必须是相同 parts 返回相同 `[0,1)` 的纯函数。默认版本为 `fnv1a-utf8-mulberry32-v1`；不调用真实时钟/Math.random。改变随机算法必须显式迁移版本，不可换实现后沿用相同存档版本。
- `persist(nextSnapshot)` 同步返回 **true** 才发布内存新状态；抛错或返回其他值均失败。默认仅确认内存事务，**不是磁盘存储**。不接受 Promise。未来 IndexedDB 应在外层副本上计算，再原子存储后发布，不能把 async persist 直接传入。
- `serializeDirector()` 返回独立可 JSON roundtrip 的快照，其中 `revision` 用作写入 expectedRevision。`savedState` 恢复现存规则快照、预留、消费事件、事务和唯一账；损坏身份/重复唯一身份直接报错，不覆盖原档。无旧版自动迁移或修复工具。

|实例方法|输入与输出|
|---|---|
|`planTick(context={})`|返回 `{revision,plans,rejectionReasons}`；同状态/定义重复调用结果固定。安全失败等待，不换品质或另抽组合。|
|`reservePlan(plan,expectedRevision,context={})`|返回稳定 `{reservationId,planId,revision}`；内部重新计算合法计划，拒绝篡改。|
|`commitPlan({transactionId,anchorId,reservationId,expectedRevision},context={})`|复查原位置，返回新实例；事务重试返回原实例。|
|`consumeCommitted(event,expectedRevision)`|接总控已提交事件，返回 `{anchorId,vacancyToken,remaining}`。eventId 与完整负载去重；同 eventId 改负载报 transactionConflict。|
|`recordResourceRemaining({transactionId,worldId,sourceInstanceId,remaining,committed,expectedRevision})`|可选部分采集镜像入口，remaining 为严格递减正整数；不制造采集成功。最后一份必须走 resourceDepleted。|
|`applyOfflineEligibility({intervalId,startWallTime,endWallTime,confirmedOffline,expectedRevision})`|wallTime 使用秒，同步返回本次 credits；confirmedOffline 必须 true，宿主不得把菜单暂停当离线。|
|`acknowledgeView({transactionId,instanceId,expectedRevision})`|只确认显示已准备，不重新建世界实例。|
|`explainAnchor(anchorId)`|返回当前/历史实例、令牌、预留、原因；调用注入空间查询，可用于开发诊断。|
|`reserveUnique({transactionId,sourceEventId,claims,expectedRevision})`|claims 每项为 `{uniqueDefinitionId,itemInstanceId,rootArtifactId}`；所有键同次成功或全部不变。|
|`transitionUnique({transactionId,uniqueDefinitionId,action,ownerId?,fragmentIds?,expectedUniqueRevision,expectedRevision})`|action 为 manifest/claim/transfer/recover/retire/absorb/fragment/reforge；世界与唯一记录双版本检查，返回原身份和新历史。|

`definitions.mjs` 导出 `sampleDefinitions`；`rng.mjs` 导出 `RNG_VERSION`、`seed32(parts)`、`randomUnit(parts)`、`fingerprint(combination)`。FNV 输入为 JSON 数组 UTF-8，固定向量 `seed32([])=1947613349`，`randomUnit([])=0.3287313864566386`。群内每只怪另有固定 lootSeed；品质/掉落只固定种子及 profile 引用，本模块不算经济掉落表。

### 空间查询合同

`spatialQuery(plan,context,stateSnapshot)` 查询整组布局，返回：

```js
{
  ecologyAllowed: true, groundSupported: true, collisionFree: true,
  reachable: true, outsideProtectedVolumes: true, pathClear: true,
  budgetAllowed: true, corpseClear: true,
  playerDistance: 100, visible: false, legalVisibleEntry: false,
  unsettledLootContainers: 0, placementId: 'authored-position-id'
}
```

布尔必需字段缺失即阻止；普通怪距离需 ≥45 米；在视野中须真实合法入场；同怪巢未结算容器 ≥3 局部停刷。适配器负责 safe station 外80米缓冲、唯一交互20米、第一/第三视角可见性、载具预测路径、水深/地形、战斗恢复窗口、总数量预算及其他预留占用。commit 复检自身 reservation 时，预算/占用查询必须排除它自己，仍计算其他 reservation。模块未连接真实空间查询，不将测试夹具的 true 当作实机场景证据。

## 与 A/B 的接口假设及集成风险

`resourceDepleted` 采用 CONTROL 最小事件 `{eventId,worldId,sourceInstanceId,kind,committed:true}`，其中 kind 本身是可信耗尽事实；可选 remaining 必须为0。库存模块应只在最后一份成功入包时发出。世界模块无法从 committed 布尔值独立证明库存已保存。部分数量可以调用可选镜像 API，也可以由库存独立保存，最后只发送耗尽事件。

怪物事件 sourceInstanceId 必须为返回 current.members 中的个体 ID，不能使用组 ID；最后成员决定群空缺。合法收服使用 populationDeparted，瞬时卸载/外出不能冒充永久迁出。stockSold/siteCleared 属总控保留事件，目前没有对应锚点实现，故拒绝而不伪装完成。尸体/遗留物的具体清单属于库存适配层，本模块从空间查询取得占用数量，不删除或重算掉落。

唯一账必须由同一世界共享 director 所有，切换角色继续使用同一快照；多个独立 director 副本不构成并发锁，需要宿主存储层 CAS/单写入协调。唯一原器不能放进普通生态组合池；本样板生态换代不产生唯一物，唯一机缘用独立批量资格接口。跨库存、事件机会与世界账的最终原子提交仍须总控集成，当前**未实现跨模块原子性**。

预留一经保存不自动过期；位置阻塞时保留原候选等待，不换候选刷品质。尚未提供管理员取消未展示技术预留、稀有池耗尽替代选择或旧档重复物迁移工具。保留旧实例与去重表以优先正确性，未做存档压缩或性能预算宣称。

## R1 开发自测历史（不代表独立验收）

在本工作区用 cmd 执行：

1. `node --test playable/tests/world-director.test.js`：**19 tests / 19 pass / 0 fail**，最近一轮约1.12秒；全程注入时钟、固定种子、空间夹具，无真实时间等待。首轮曾有1个预期随机向量值写错，已校准并重跑通过。
2. `node --check playable/src/world-director/director.mjs`、`definitions.mjs`、`rng.mjs`（后两项使用同目录完整相对路径）及 `node --check playable/tests/world-director.test.js`：全部退出0。
3. `git diff --check`：退出0；新文件尚未跟踪，另核对 `git status --short --untracked-files=all`，代码新增仅在授权的三份模块文件及一份测试。

测试覆盖无消耗长时间不刷、部分/未提交/失败写入、最后怪物消费、一次令牌、冷却、安全/视线/尸体/预算阻止、位置不可偷换、仅同组合等待、96小时离线限额与区间重放、预留存档重载、模型确认、事务篡改/版本冲突、唯一双键原子预留、流转/托管/退役、碎片原身份重铸、存档损坏拒绝、旧规则保存、锚点顺序不扰随机流。100代循环验证101个不同实例和100个已用令牌，每一代组合均不同于上一代。

未执行构建、浏览器或主游戏按键/视角实机测试；没有改动这些路径。未开发全世界生态、建筑/货架/动态NPC、洞府生成、普通8%/永久0.3%调查、逆天分支抽签、3D或UI。

## 总控下一步

先冻结 DEV-C-R2 并新建独立 TEST-C-R2，通过独立验收后再按总控安排集成产品模块与测试（verification脚本仅供开发复测）。然后把 B 的真实最后一份采集和 A 的成员死亡接入 director，在主存储适配层组成同一原子快照，补真实空间/预算查询与模型完成确认。以一处草、一组怪验证采集→库存→消耗→离开视野→冷却→新代，并检查存储失败与读档不复制。完成报告后停止扩展。
