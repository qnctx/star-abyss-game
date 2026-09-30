# DEV-A-R2 战斗数值模块交付

2026-09-12。状态：**依据TEST-A-R1失败报告修复F1/F2，交付DEV-A-R2；开发者自测22/22、开发者复跑原独立断言17/17通过。实现和测试文件再次冻结，等待总控另建全新TEST-A-R2。尚未通过最终模块验收，未接入主游戏，未做场景实机验收。**

历史：总控迁移时曾仅将“模块验收通过”更正为“开发者自测通过，独立验收待完成”，当时未改代码或重跑测试。随后收到正式独立失败报告才开始本轮R2修复。新总控任务ID为 `01a094be-fe94-7c23-9b24-13f777c81d8d`，权威主目录仍为 `E:/myProject/star-abyss-game`。

## R2修复、复跑与冻结证据

依据独立报告：`C:/Users/HUAWEI/.codex/worktrees/8266/star-abyss-game/docs/development/reports/TEST-A-R1.md`。接受其失败结论，不将R1自测16/16作为独立验收。

- **F1/P1**：R1每分量8位截断会令1/3+2/3变为0.99999999，漏掉1血死亡与提交事件。R2在伤害解析中使用约分后的BigInt有理数，贯穿防御保留比例、通用减伤、屏障/个人盾余量、跨分量及跨分段生命余数；只在实际整点生命扣除时取整。小于整点的真实值仍不提前扣血，未使用epsilon、每段最少1或修改独立预期。卡片预算/属性/破防输入仍按原8位定点合同计算，本轮不扩展其规则。
- **F2/P2**：同段新hitId别名重试现在返回新state，在hits中登记该别名的signature及 `aliasOf`，不扣血、不再次发事件。JSON保存后该别名改段、改目标、改施放或屏障请求均触发ID冲突。相同已登记ID的同请求重试仍返回原state；旧state始终不被就地修改。调用者必须保存duplicate分支返回的state，不能因duplicate就忽略别名登记。
- 自测新增6项：同通道/混合通道的整点致命与严格不足整点反例；跨段换防御+JSON读档；有理盾余量读档与生命余数衔接；别名/死亡后别名/冲突纯度；非法与不匹配精度元数据；R1有限小数存档续算。

实际命令与结果（均为开发者执行，不能替代全新独立验收）：

|命令|结果|
|---|---|
|`node --test playable/tests/d3-combat.test.js`|22 tests / 22 pass / 0 fail，退出0|
|`node playable/tests/d3-combat.test.js --replay-r1`|开发22项＋复跑驱动1项共23/23；子进程原独立断言17/17；原最小复现F1/F1b为扣1血、HP0、事件1，F2为hit ID conflict；退出0|
|`node --check playable/src/d3-combat/index.mjs`|退出0|
|`node --check playable/src/d3-combat/fixed.mjs`|退出0|
|`git diff --check`|退出0；新文件仍为未跟踪，不能代替内容验收|

复跑入口在自有 `playable/tests/d3-combat.test.js` 的 `--replay-r1` 可选分支。它只读独立工作区的 `independent.test.mjs` 与 `minimal-repro.mjs`，在内存把冻结R1模块绝对导入重定向到本R2模块，并取消独立观察记录向原文件写入；独立输入、断言、预期全部保持原样，经Node子进程stdin执行。TAP及最小复现输出打印到终端，没有写独立工作区、冻结目录或主项目。启动和结束校验R1冻结3文件的既有SHA-256，以及独立测试目录全部文件的前后SHA-256，全部不变。没有把“原独立测试通过”冒充测试任务对R2的独立验收。

R2实现/自测冻结哈希（cmd `certutil -hashfile <file> SHA256` 实际输出）：

|相对路径|SHA-256|
|---|---|
|`playable/src/d3-combat/fixed.mjs`|`434e3ace9d094fd4212b38381981c2394cba0b3ebe234706afcc885fb8424f59`|
|`playable/src/d3-combat/index.mjs`|`06877a2dd12a0a11a6a7dbf3d2fe4979b8cf28d4f41436255352c806756476d4`|
|`playable/tests/d3-combat.test.js`|`c38647421bbe7bf952a1a99818718eebdad9b8218387d32fa14c105d7b22b74b`|

R1冻结交付 `C:/Users/HUAWEI/.codex/worktrees/c0e3/star-abyss-game/artifacts/deliveries/DEV-A-R1` 和独立测试原件全部保留。本轮仍只改下列自有4文件，未集成、未提交、未推送。

### R2 API与存档精度变更

- `createCombatState` 新建 `version:2`。从旧state产生新状态的施放、命中、别名登记、中断、熟练度更新也标2；纯重试不产生新状态时保留旧version。
- `resolveDamage` 增加可选输入/返回 `carryExact:{numerator,denominator}`；字段为十进制整数字符串，表达**生命点单位**的非负约分分数。例如1/3为 `{numerator:'1',denominator:'3'}`，零为 `0/1`。原 `carry` 字符串保留为向下截断8位的显示值，不能用它代替carryExact续算。调用独立纯解析API续算时两个字段一起传；`resolveHit` 自动保存到 `casts[].targets[].carryExact`。
- 规范化屏障和个人盾新增 `amountExact`，同样为生命点单位分数；原 `amount` 保留8位显示值。吸收及同名取高/总盾额度操作都保留分数，不把细余量转移丢失到盾。命中日志中的小数仍是显示投影，不能重新累加这些显示值推导实际生命。
- 精确字段若给出，必须是合法非负分子、正分母，且其8位截断与对应decimal字段一致，否则抛错，原输入不变。适配器若主动重新赋予盾量，须同时更新精确字段，或替换为不含旧 `amountExact` 的新盾条目；不能只改amount留下过期元数据。
- R1缺少精确字段时按其已有有限小数原值读入，可续算并在新状态中产生精确字段。**不能恢复R1已经丢失的有理余数或补发过去漏掉的死亡事件，也不能恢复R1未保存的历史别名请求。** 如需完全可重演的旧战斗，应从未受损的施放前快照重演；本轮不增加自动补偿或历史事件重建。
- R2写出的精确字段不得被旧R1实现读取后丢弃再续算；不承诺向旧写入器降级兼容。存档/跨模块适配层须原样保留这些字段。分母会随不同防御比例增长，当前采用约分BigInt；本轮未做超长战斗存档的压力验收，未通过截断限制分母来换取性能。

## 工作区与依据

- DEV-A正式任务ID：`01a094b3-4922-7670-854f-5063091a5d9b`（由当前进程 `CODEX_THREAD_ID` 核实）。
- 独立工作区：`C:/Users/HUAWEI/.codex/worktrees/2f23/star-abyss-game`。
- Git 状态：detached HEAD；基线 `5fdb455d3c46601ebd584e64bcf72a2b5c82baf4`；没有创建分支、提交或推送。
- 读取主项目 `E:/myProject/star-abyss-game/docs/development/CONTROL.md` 及 `docs/cultivation/01_REALMS_AND_CULTIVATION.md`、`02_COMBAT_WEAPONS_SKILLS.md`、`19_DAMAGE_ATTRIBUTES_AND_MASTERY.md`、`20_PLAYER_MARTIAL_ARTS_60.md`、`26_HEAVEN_DEFYING_LEGACIES.md`。以主项目第19章为公式基准，未把工作区旧稿覆盖回去。
- 未写主目录；未修改主入口、公共资产、package.json、构建产物、输入、相机或其他任务代码；未使用收费生成。只使用 cmd/Node 和补丁工具。

## 改动文件

|文件|作用|
|---|---|
|`playable/src/d3-combat/fixed.mjs`|BigInt 定点/有理数解析运算、合法性检查、最大余数分摊|
|`playable/src/d3-combat/index.mjs`|属性/五阶/伤害与盾解析；施放、命中、熟练度的纯状态转移|
|`playable/tests/d3-combat.test.js`|22 项Node开发者自测，以及可选原独立R1用例复跑入口|
|`docs/development/reports/DEV-A.md`|本交付报告与接口合同|

## 导出 API

主入口为 ES module `playable/src/d3-combat/index.mjs`。没有外部运行时依赖，不读取 DOM、Three.js、localStorage、真实时间或随机数。

|API|输入与返回|
|---|---|
|`masteryMultipliers(stage)`|1—5 → `{damage, healing, shield, control}`，各倍率为十进制字符串|
|`passiveMultiplier(stage, quality=3)`|五阶功法常驻倍率；Q1—Q6仅放大超出1的增量|
|`baseResource(realm, level=1)`|基础电容/真气池十进制字符串，R0恒为100|
|`computeAttributes({realm,level,modifiers,heavenOverride})`|返回 `{permanent,effective,coreId,baseResource}`；五属性名为 `maxHp/attack/spellPower/defense/resistance`|
|`snapshotSkill({source,skill,damageBonuses,weakPoint})`|固化已学层级、A/S、五阶与增伤；返回 `raw/total/segments/maxTargets` 等|
|`effectiveDefense({defense,reductions,penetration})`|固定减防→百分比减防→百分比穿透→固定穿透；返回十进制字符串|
|`personalShields(maxHp, shields)`|同ID取高、异ID合计60%封顶，按输入顺序占用额度；返回规范化盾数组|
|`resolveDamage({target,components,barrierIds,carry,carryExact})`|纯解析：返回新 `target/carry/carryExact/lifeLoss/defeated/components`；不修改输入|
|`supportAmount({base,mastery,kind,...})`|`kind=healing/shield/control`；治疗另接受缺失生命、受疗增益与抑制；只返回数额，不自动修改生命或施加状态|
|`createCombatState({worldId,actors})`|建立 JSON 可序列化状态 `{version,worldId,actors,casts,hits,practice}`|
|`commitCast(state,request)`|验证施放输入、存活/在场、资源与层级，扣起手消耗、保存快照；返回 `{state,cast,duplicate}`|
|`resolveHit(state,request)`|使用快照及目标当前盾/抗性，提交一次合法分段；返回 `{state,result,duplicate,events}`|
|`interruptCast(state,castId)`|返回中断后的状态；已扣消耗不返还；不能再提交该施放命中|
|`awardPractice(state,{actorId,skillId,eventId,evidence,effective})`|真实有效证据普通5/精确10/试炼30，同事件只补最高差值；返回 `{state,awarded,total}`|

### 数额、属性与核心

普通数额输入使用非负十进制字符串；也接受安全范围内且能写成最多8位小数的 Number。拒绝 NaN、Infinity、负数、空串、科学计数法、不安全 Number、超过8位小数。大数必须传字符串，返回金额/属性不转 Number。基础属性、技能预算和有效防御仍使用 `SCALE=100000000n` 定点，乘法在8位精度截断，分段预算通过最大余数法守恒。R2伤害解析则保留精确分数贯穿屏障、抗性/通用减伤、个人盾及生命余数，整点扣血前不逐分量截断；显示字符串截断到8位，真实续算使用carryExact/amountExact。详见上方R2精度合同。

每个属性的 `modifiers[stat]` 支持：

- `equipmentFlat/temporaryFlat`：固定值数组，先加。
- `constitutionBonuses`：同桶加算，上限0.8。
- `practiceBonuses/equipmentBonuses`：这里传**超出1的增量**，例如1.35传0.35；各桶倍率上限1.8。可以将 `passiveMultiplier` 的结果减1后作为功法增量。
- `temporaryMultiplier`：临时属性倍率，默认1。

`permanent` 表示本次普通公式在临时**倍率**和核心前的结果，**含本次 temporaryFlat**，不是可直接交给分身的无临时效果快照。本批未提供分身继承接口。`effective` 是施放用属性。装备词条唯一性由装备适配层保障，不要将同一词条同时填固定和百分比入口。

`heavenOverride` 仅允许一个 `{coreId,multipliers:{attack:'3.2',...}}`，不能传核心数组。同属性临时倍率与已指定核心倍率取最高，只应用一次。倍率是否已解锁/激活、多个同核心候选的最高值由适配层确定；本模块不会根据核心ID自动赠送倍率，也不会生成分身、临时生命、AI、冷却或世界权限。不要把核心倍率重复放入 `damageBonuses`。

### 施放和命中合同

actor 必须含 `id/realm/maxHp/hp`，可含 `attack/spellPower/defense/resistance/level/resource`。默认基础资源池，`resource` 允许装备扩池；消耗始终按基础池计算。R0单池记为capacitor，R1以上单池记为qi。`present:false`、零血或来源 `canCast:false` 阻止新施放；不在场/零血目标阻止新命中。

skill 至少含 `id/minimumRealm/C/a/b/channel`。可选 `learnedTier`（默认minimumRealm，不能高于来源境界）、`mastery`（默认1）、`costPercent`（0—1的小数）、`weights`（正数且合计1，最多256段）、`maxTargets`（默认1）。`kind:basic/heavy` 显式使用0/1/0或0/1.8/0，不吃主动掌握倍率；默认kind为skill。

`channel=physical/spiritual/direct`。灵术必须给元素 `metal/wood/water/fire/earth/wind/thunder/ice/light/dark/poison/space/mind`。物理技能的元素主题不增加另一个通道。`penetration={flat,percent}` 只属于该分量。混合技传 `components:[{id,channel,element?,weight,penetration?},...]`，合计权重1；先分摊整次预算再分摊分量，不重复乘M。

目标 `physicalReductions` 和 `spiritualReductions[element]` 是 `{id,flat?,percent?}` 数组；同ID各桶取最高，不按每段增加。这些数组必须由适配层按模拟时间移除已过期项。目标可传 `elementResistance[element]`、`vulnerability` 数组和 `damageReduction` 数组。抗性、通用减伤、易伤遵守19章上限。`barriers/shields` 条目为 `{id,amount,channels?,elements?}`。

`commitCast` request：`{worldId,castId,sourceId,skill,damageBonuses?,weakPoint?}`。`resolveHit` request：`{worldId,castId,hitId,targetId,segment,barrierIds?}`，segment从0开始。`barrierIds` 是碰撞层已确认相交的有序屏障ID；缺省空数组不会凭空用身后屏障挡伤。屏障按入射消耗，个人盾按防御后的伤害消耗。

相同castId/hitId和相同请求重试返回duplicate；相同ID不同请求抛冲突。即使换一个hitId，同施放、同目标、同segment也只结算一次；R2在duplicate返回的新state中登记别名签名，必须保存该state。失败抛异常，原state保持不变。JSON读档后保留账本及精确数额继续去重/续算；持久化后不要清空casts/hits或复用代际实例ID。

### 最小可运行接入示例

```js
import { createCombatState, commitCast, resolveHit } from './playable/src/d3-combat/index.mjs';
let state = createCombatState({
  worldId: 'world-1',
  actors: [
    { id: 'player-1', realm: 0, maxHp: '120', hp: '120', attack: '12', spellPower: '10' },
    { id: 'beast-generation-1', realm: 0, maxHp: '48', hp: '48', defense: '2', defeatEligible: true }
  ]
});
state = commitCast(state, {
  worldId: 'world-1', castId: 'cast-1', sourceId: 'player-1',
  skill: { id: 'WS01', minimumRealm: 0, mastery: 1, C: '6', a: '1.3', b: '0', channel: 'physical', costPercent: '0.06' }
}).state;
const hit = resolveHit(state, {
  worldId: 'world-1', castId: 'cast-1', hitId: 'hit-1', targetId: 'beast-generation-1', segment: 0
});
state = hit.state; // 野兽HP=28；玩家电容=94；本次实际掉血20。
const save = JSON.stringify(state);
```

## 历史R1开发者自测记录与文档差异

此前开发者在本工作区内实际运行，结果不代表独立验收：

1. `node --check playable/src/d3-combat/index.mjs`：退出码0。
2. `node --test playable/tests/d3-combat.test.js`：**16 tests / 16 pass / 0 fail**，Node内置test，无新依赖。
3. `git diff --check`：退出码0；源代码与测试当前为未跟踪新文件，故该命令并不能代替新文件内容验收。

测试覆盖：241完整管线与消耗日志；五阶三类向量；普通/重击不吃主动M；属性加乘/品质/核心与丹药取高；破防顺序与同ID去重；直伤与元素独立穿透；各减伤上限；同名盾及60%总盾；目标换盾和来源换装快照；十段高防与三/七段权重总额；混合分量；目标数限制；施放/命中JSON重载重试；过量伤害按实际HP记账；失败回滚、中断不返资源、跨世界和离场；同熟练事件只补最高差值；R9以及超过JS安全整数的大数精确算例；非法值。

首轮15/16通过，唯一失败揭示主项目19章手算中间值笔误。正确计算为：

`497.24 × (2/3) × 1.10 × 0.80 = 291.714133333…`。

R1读取的设计稿写的是 `291.714666…`；程序保留公式，修正测试期望为8位截断的 `291.71413333`，扣个人盾50后向下取整仍为**241**。总控在R2通知中已确认主项目第19章及手册修正为 `291.714133333…`；本DEV未修改主项目。没有将常量291或241写进结算实现。

## 边界、跨模块假设和下一步

- 已完成数值基础与可运行状态转移，未做60技目录、动画、碰撞、AI、装备/秘籍实际库存或主入口接线。第26章止于显式单核心属性入口，没有全技能或双分身AI。
- 学习资格证据、战斗状态、前后摇、冷却、弹体存续、H5视线/距离/锁定前后反制、命中时间合法性由适配层判定；本模块只在收到合格命中时算数。不能将本批测试称为H5/低帧率物理碰撞实机验收。离开当前战斗实例时须由适配层标 `present:false`，世界ID校验不能替代场景实例管理。
- 控制仅提供掌握倍率数额计算，未实现5秒共用抗控账本、眩晕/击飞1.2秒上限及首领破势。治疗/护盾数额API不替代实际技能提交；DOT刷新、潮湿雷击、状态到期、生命债、临时生命层、吸血/反伤触发链尚未接入。
- `defeatEligible:true` 明确表示可产生击败提交事件的敌方实例；默认不发。首次真实HP归零返回 `{eventId,worldId,sourceInstanceId:目标实例ID,kind:'defeatCommitted',committed:true}`。重试返回events空数组；实际扣血单列，可供吸血/反伤适配层使用。事件不代表已发材料、经验或完成库存事务。
- B/C集成必须将本模块的新state和待消费事件放入同一原子快照/发件箱，再驱动奖励与世界空缺。当前没有跨模块原子性。每代敌人使用新实例ID；不要把复活/再生成当相同死亡实例复用。
- 几何盾暂随目标存储，适配层须确保一个实际屏障只有一个权威耐久归属；不要为群体屏障在各目标复制独立耐久。共享场景屏障实体账本待场景切片接入。
- 当前state为受信任模块存档，未提供任意外部存档格式迁移/完整防篡改校验；casts/hits账本不自动裁剪。后续存档适配器需在不丢去重依据的情况下设计回收策略。
- 下一步由新总控另建全新TEST-A-R2，针对本R2冻结交付独立验收；若再次失败，只在收到报告后修复，再另建独立复测任务。独立验收通过后再由总控决定集成这4个自有文件，先接一怪一招和实际碰撞，再联动B/C的原子提交。场景中需对照20点WS01新手伤害、电容扣6、盾消耗、重复碰撞及死亡事件操作验收，然后才能标“主游戏已实装”。

本任务实现与测试文件冻结，不自行集成或扩展；等待独立测试报告。后续修复交付继续通过本DEV-A报告向新总控汇报。
