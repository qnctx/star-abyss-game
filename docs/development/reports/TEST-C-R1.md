# TEST-C-R1 独立功能测试报告

2026-09-12。结论：**失败，退回总控安排开发修复。DEV-C-R1 未通过模块验收，未接入场景。** 开发测试19/19通过；独立测试10项中9通过、1失败。不是开发自测结论的转述。

## 身份、范围与版本

- 正式总控任务：`01a094be-fe94-7c23-9b24-13f777c81d8d`。
- 开发任务：`01a094b3-a4b4-7273-a04f-e7ee8518c096`。
- 测试工作区：`C:/Users/HUAWEI/.codex/worktrees/e653/star-abyss-game`；基线 `5fdb455d3c46601ebd584e64bcf72a2b5c82baf4`，独立 detached HEAD；开始时 git status 干净。
- 原开发工作区：`C:/Users/HUAWEI/.codex/worktrees/8712/star-abyss-game`。
- 唯一被测冻结目录：`C:/Users/HUAWEI/.codex/worktrees/c0e3/star-abyss-game/artifacts/deliveries/DEV-C-R1`。
- 先读取主项目 `E:/myProject/star-abyss-game/docs/development/CONTROL.md`、主项目 cultivation 08/09/11/26/27/28、原开发报告。实际适用指令文件为 `C:/Users/HUAWEI/.codex/AGENTS.md`；向上检查及项目内 AGENTS 搜索未找到额外项目文件。27的世界唯一与消耗驱动规则优先。
- 首先核验 manifest 中全部4个文件的 SHA-256/字节数，再复制到本工作区 `artifacts/tests/TEST-C-R1/frozen/` 并二次核验；所有 import 均指向该副本，未执行本工作区旧基线实现。最后执行后再次确认冻结原件和副本哈希都未改变。

|被测文件（相对冻结目录）|SHA-256|字节|
|---|---|---|
|playable/src/world-director/definitions.mjs|3d208976f511b0ec4686d725a502f412950fd08593de4a4f9048f99a9ab060ef|1114|
|playable/src/world-director/director.mjs|4fb26984e85b19c18e883c771435f03c7d298b368c943c1a7b424824357f624a|20832|
|playable/src/world-director/rng.mjs|3460f390a4ea4118542788f5afa7407e5746ea2839a47bf32f4040b0e7f8ed02|747|
|playable/tests/world-director.test.js|78e4fd7c80e644b8dc93545151873c1d96fd564ee58dc8c8beb80d6a439efabb|19931|

## 执行入口与证据

以下命令在测试工作区用 cmd、Node v22.14.0 执行，无新依赖：

```text
node artifacts/tests/TEST-C-R1/prepare.cjs
node --test artifacts/tests/TEST-C-R1/frozen/playable/tests/world-director.test.js
node --test artifacts/tests/TEST-C-R1/independent.test.mjs
node artifacts/tests/TEST-C-R1/repro-historical-fragment.mjs
node artifacts/tests/TEST-C-R1/run.cjs
```

`run.cjs` 使用 spawnSync 保存真实子进程退出码、完整日志并复核哈希：开发测试退出0；独立测试退出1；最小复现检测到缺陷退出1；总运行退出1。早期 cmd 的重定向后接 type 会返回 type 的退出码，最终判定只采用 runner 记录的子进程退出码。首次 bash 入口因未安装 WSL 失败，随后使用 cmd；一次 node -e 和一次带空格 rg 的引号解析失败，均未用于验收结论，改为脚本/精确搜索完成。

所有证据位于 `C:/Users/HUAWEI/.codex/worktrees/e653/star-abyss-game/artifacts/tests/TEST-C-R1/`：

- `manifest.json`、`hash-verification.json`、`run-results.json`：冻结来源、完整哈希、运行命令与退出码。
- `developer-test.tap`：19项开发测试全部通过，包括100代循环、双键成功预留、失败写入的新代原态保留、1800秒离线上限等。
- `independent.test.mjs`、`independent-test.tap`：独立用例和逐项真实结果。
- `repro-historical-fragment.mjs`、`repro.log`、`repro-state.json`：最小失败复现及完整前态/接受结果/后态/重载态。

## 独立输入、预期与实际

独立夹具使用秒单位可控时钟、固定种子和同步持久化成功/false/抛错开关。空间函数只是模块合同夹具，**不能作为实际地形、真实3D安全或AI预算验收证据**。

|编号|操作与预期|实际|结论|
|---|---|---|---|
|I01|首次草放置后等待7200秒不变；采至剩1后离线96小时、JSON重载；未提交耗尽被拒绝且全态不变|同实例/品质；剩1、无令牌、零离线抵扣；未提交拒绝|通过|
|I02|91秒耗尽；dueAt−0.001不可计划、dueAt可预留；预留重载、提交重载、旧事务重试；新事件消费旧实例被拒绝|冷却从91秒开始；新ID/不同指纹；令牌使用表恰好1条；重复提交全态不变|通过|
|I03|预留怪群后逐个令8项安全/预算标志为false/缺失；距离44.999、视野无入场、3个容器、换位置拒绝；45米/合法可见入场/2容器允许|全部阻止项保持全态和预留；恢复条件后同预留成功|通过，仅模块查询合同|
|I04|首成员合法迁出、其余击败；每次重放事件|仅最后成员给令牌，剩余0；重试返回原结果且无额外状态变化|通过|
|I05|只有ID、品质、权重不同的两套相同实际组合；耗尽且到期|noDistinctCandidate；反复计划不修改状态|通过|
|I06|首代离线100秒；同令牌后续区间不累加；新代耗尽重载后同时间改ID不给；重叠8900—9050仅新增50秒|分别100/0/0/50秒；再长离线也不累加该令牌|通过|
|I07|persist返回false及抛错，分别注入预留、部分采集、耗尽、离线、显示确认、唯一预留和显现|每次错误前后完整快照深相等；失败事务不记入状态|通过|
|I08|MYW已占时批量预留MYF+MYW，第二键冲突；显现→角色A→NPC→托管→重载→角色B→退役→重载；另一来源再占|批量全回滚，MYF没有残留；原item/root不变；退役仍拒绝再占|通过|
|I09|拆3片后重载；缺片/重复片/外来片重铸；齐片逆序重铸再重载；重复重铸与再次拆分复用旧片|非法集合拒绝且全态不变；原器身份保留；重复重铸/拆分复用旧片拒绝|通过|
|I10|拆片重铸后重载，用消耗过的旧片ID作为另一个唯一键的原器itemInstanceId|应拒绝且原态不变；实际成功预留，revision递增，生成两个不同root的身份关联，随后重载也接受|**失败 F01**|

## F01：重铸后的历史碎片身份可被另一唯一原器重新使用

严重度：P2，唯一身份账完整性缺陷，阻止本轮模块验收。正常API调用即可触发，不需要修改存档。没有证据表明它已在主游戏复制出实物；本轮确认的是世界账错误接受身份复用。

最小复现步骤：

1. 用空 anchors 的合法定义创建世界w，预留 MYW01，item=`original-sword`、root=`root-A`。
2. manifest → claim(player) → fragment(`old-fragment-1`,`old-fragment-2`) → reforge(完整原片)。
3. JSON序列化并重载；原片现在只留在MYW01历史中。
4. 预留 MYW02，item=`old-fragment-1`、root=`root-B`，使用新事务和新来源。
5. 预期 `uniqueIdentityConflict` 且快照不变。实际返回 reserved 的 MYW02，revision从6变7；原片ID仍在MYW01拆片/重铸历史，同时成为MYW02原器ID。对错误后态再次重载不报错。

定位冻结 `director.mjs`：reserveUnique约260—266行只检查现存item/root/fragments；reforge在296行清空活动fragments；fragment在290—292行反而检查历史fragmentIds，导致两条创建身份入口约束不一致；validateSave的unique身份校验同样不检查历史片ID。

依据：CONTROL稳定身份与拆片root合同；27第6节原片被消耗且仅恢复同一原器；开发报告承诺片ID不可再次使用。历史消耗片ID必须继续可追溯到原root，不能通过另一唯一原器入口改绑另一root。交由开发修复后，应新开独立R2复测；本会话未修实现或冻结文件。

## 已完成及未覆盖边界

已完成本冻结模块的哈希验证、开发回归、独立边界与失败复现。被测导出为 createDirector/validateDefinitions、sampleDefinitions，以及RNG_VERSION/seed32/randomUnit/fingerprint；本次不新增产品API。实例API覆盖计划/预留/提交、消费、部分资源镜像、离线、显示确认、唯一资格/流转、序列化。

未覆盖或未实现：实际库存入包/满包、战斗伤害/死亡来源可信度、真实掉落保留、跨A/B/C原子提交、持久层CAS并发、多director进程、真实暂停/后台识别与磁盘崩溃恢复；真实3D视线/45米距离测量、安全站80米/唯一交互20米、载具预测路径、实际数量预算及预留互斥；建筑、商店、NPC完整人口/抢夺、洞府首次调查及稀有池耗尽、旧档迁移工具、全世界性能。夹具不给出这些场景的通过结论。唯一键配对由调用者传claims，本轮不验未实现的MYF候选选择业务。

对其他模块假设：committed事件已由库存/战斗真实成功产生；空间适配器正确计算其他预留并排除自身占用；同世界角色共享同一世界账。上述宿主假设不能由本模块测试代证。

文件改动仅本报告及 `artifacts/tests/TEST-C-R1/` 的脚本、证据、核验副本。未写主项目、未改开发实现、未构建game.js、未用收费生成、未读输出密钥、未提交推送。总控下一步为先退开发修复F01并冻结新版本，另建独立复测；通过后才安排A/B/C联动及真实场景接入验收。报告完成即停止扩展。
