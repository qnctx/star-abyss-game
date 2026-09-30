# TEST-A-R1 独立功能测试报告

2026-09-12。**结论：失败，退回总控交开发修复。** 冻结交付 DEV-A-R1 的3个文件 SHA-256全部匹配；直接导入冻结真实实现，开发测试复跑16/16通过；独立测试17项，13通过、4失败，归为2个问题。未修改开发实现，未接入或验收游戏场景，不得标记模块验收通过或主游戏已实装。

## 身份、范围与依据

- 总控正式任务：`01a094be-fe94-7c23-9b24-13f777c81d8d`。
- 本测试正式任务：`01a094c1-f125-77d2-b40f-ecf79fbe376a`，由 `CODEX_THREAD_ID` 核实；只测 DEV-A-R1。
- 测试工作区：`C:/Users/HUAWEI/.codex/worktrees/8266/star-abyss-game`；detached HEAD，基线 `5fdb455d3c46601ebd584e64bcf72a2b5c82baf4`；初始 git status为空。
- 开发原工作区：`C:/Users/HUAWEI/.codex/worktrees/2f23/star-abyss-game`。
- 被测冻结目录：`C:/Users/HUAWEI/.codex/worktrees/c0e3/star-abyss-game/artifacts/deliveries/DEV-A-R1`，manifest创建时间 `2026-09-12T08:35:00.765Z`。
- 实际读取 `E:/myProject/star-abyss-game/docs/development/CONTROL.md`、主项目 cultivation 01、02、19、20、26，以及开发工作区 `docs/development/reports/DEV-A.md`。公式以主项目19章为准，26只验本轮交付的单核心数值接口。
- 读取磁盘 `C:/Users/HUAWEI/.codex/AGENTS.md`；检查主项目、测试工作区及父目录未发现额外适用AGENTS。使用cmd和Node v22.14.0，无新依赖。尝试 `codegraph context resolveDamage` 返回当前工作区未初始化，因此直接读取冻结模块；未初始化或改写代码索引。
- 仅新增本报告和 `artifacts/tests/TEST-A-R1/`。未写主项目、冻结目录或开发工作区，未运行构建、未覆盖game.js，未提交/推送，无收费生成，无密钥读取输出。

## 被测文件和版本证明

以下路径相对于上述冻结目录；不是测试工作区的默认基线文件。测试套件和最小复现均使用 `file:///C:/Users/HUAWEI/.codex/worktrees/c0e3/star-abyss-game/artifacts/deliveries/DEV-A-R1/playable/src/d3-combat/index.mjs`，其相对依赖自然指向同冻结目录的fixed.mjs。

|被测文件|字节|SHA-256，预期=实测|
|---|---:|---|
|playable/src/d3-combat/fixed.mjs|2494|191a300c1f07ec010ff92bf2a72c246aaba08cd3a55a7501cd318280a3eac925|
|playable/src/d3-combat/index.mjs|19306|f5e27463c6391f658658e5ccb638e7f78dcbe306386fc820d0788b09a284b6e8|
|playable/tests/d3-combat.test.js|16930|ffbf59119a2b77a891b4990fcf505d3a58c5fdba6f36f124452fbf3ccd113672|

执行前核验见 [hash-verification.json](../../../artifacts/tests/TEST-A-R1/hash-verification.json)，结束复核见 [post-test-hashes.json](../../../artifacts/tests/TEST-A-R1/post-test-hashes.json)。manifest提供的原工作区用于来源记录，本次没有把开发工作区或旧基线作为被测入口。

## 复跑命令与证据

在测试工作区用cmd执行：

```bat
node artifacts/tests/TEST-A-R1/verify-and-run.cjs
node --test artifacts/tests/TEST-A-R1/independent.test.mjs > artifacts/tests/TEST-A-R1/independent-tests.tap 2>&1
node artifacts/tests/TEST-A-R1/minimal-repro.mjs > artifacts/tests/TEST-A-R1/minimal-repro.json.log 2>&1
node artifacts/tests/TEST-A-R1/verify-and-run.cjs --hash-only
```

第一条先核验清单，任一不符退出2且不执行开发测试；一致后spawn Node直接运行冻结目录 `playable/tests/d3-combat.test.js`。退出0，16通过0失败，见 [developer-tests.tap](../../../artifacts/tests/TEST-A-R1/developer-tests.tap)。第二条退出1：17项13通过4失败，见 [independent-tests.tap](../../../artifacts/tests/TEST-A-R1/independent-tests.tap)。第三条退出0表示复现脚本正常输出，不表示实现通过；输出保留预期、实际和完整分量日志。

独立用例：[independent.test.mjs](../../../artifacts/tests/TEST-A-R1/independent.test.mjs)。断言预期和实际逐条保存在 [independent-observations.json](../../../artifacts/tests/TEST-A-R1/independent-observations.json)。预期来自规格常量、手算和测试侧BigInt算式，不使用被测fixed/allocate函数作预言机。

测试编写期间修正过测试自身的两个预期错误：早期6伤害/D80并非1伤害；D200还触发80%抗性上限，不能按1/6保留。最终失败复现改用D80与R20，均低于封顶，不将这些早期预期错误作为实现缺陷。最终TAP为修正后全套执行结果。

## 逐项预期、实际及结论

|用例|输入/步骤与独立预期|最终实际|结论|
|---|---|---|---|
|A01 19章241管线|A200/S160，12/1.2/.4，三阶；raw442.4→597.24→墙后497.24→Deff120→291.71413333→盾50→HP损失241，余0.71413333；输入不变|全部相符，墙和个人盾均清零|通过|
|A02 五阶与支持|基础100，伤害100/118/140/168/200，盾和治疗100/110/122/136/150，控制100/105/110/115/120；Q1/Q6五阶功法1.28/1.455；治疗双封顶112.5|全部相符|通过|
|A03 属性/核心|R0L10，体质.4、功法.35、装备.4；A83.19024/D69.3252/H831.9024，核心A266.208768/D152.51544；对R1D60普攻66/212；A10普攻/重击10/18|全部相符；丹药1.7与核心3.2取高|通过|
|A04 高阶精度|100个境界/小级的五属性独立BigInt核对；R9、输入900719925474099312345678，防御K/2时损失floor(输入×2/3)；技能大整数快照核对|全部精确匹配，不经过Number大数计算|通过|
|A05 破防/封顶|固定减防同ID取60再加40，百分比.2+.2，穿透.25再减5：Deff400；超穿透归0；综合保留.15×易伤1.5，100入射损失22余.5|全部相符|通过|
|A06 同攻击四通道|物理主题火、火术、冰术、直伤各30；局部穿透，火墙10，冰盾10；盾前30/6.66666666/15/30，最终71余.66666666|全部相符；物理火主题不误作火术|通过|
|A07 多段预算|7.00000001按七段和物/直分量拆分，入射和守恒；另7伤害七段逐段JSON读档，最终扣7、余0|全部相符；没有每段满额或最少1膨胀|通过|
|A08 快照/现态/读档|来源A3、a1快照；首段1.5→扣1余.5；读档后来源A9999，目标D40加新盾.25；第二段盾前.75，扣1余0，总HP998|相符；确实使用旧来源攻击与新目标状态|通过|
|A09 同攻击共用墙与换盾|40预算两段、各段物/直各10；墙8首段只扣一次，损失12；第二段D40、物盾5，损失10|全部相符|通过|
|A10 真实死亡/重试|2血目标受6伤只记实际2，一次defeatCommitted；JSON后同hit/新hit同段不再发；已登记ID冲突拒绝；另一已施放技能不得新命中死目标；非eligible不发|相符；事件sourceInstanceId为目标实例ID|通过|
|A11 非法输入失败不变|负数/NaN/Infinity/空串/指数/9位小数/不安全Number，权重、费用、层级、通道、重复分量ID，非法分段/跨世界/屏障，后分量报错|均抛错；原状态/原目标deepEqual不变|通过|
|A12 中断/离场|起手扣6后资源94，中断阻止命中不退费；目标present=false阻止新命中|相符，输入不变|通过|
|A13 熟练事件|无效→普通→精确→普通→试炼→试炼，每步读档；增量0/5/5/0/20/0，总0/5/10/10/30/30|全部相符|通过|
|A14 同通道整数边界|D80，整次3伤与两次1.5均应杀1血；同攻击三个1伤分量，应floor(1/3+1/3+1/3)=1|整次和两段通过；三分量损失0、HP1、defeated=false|失败F1|
|A15 别名ID冲突|h0命中段0；alias重试段0成功去重；读档后alias改段1必须拒绝ID冲突|不抛错，返回新的有效命中|失败F2|
|A16 混合通道真实死亡|总2伤、物/火术各1；目标D80/R20/HP1，1/3+2/3=1，预期掉1、余0、HP0、事件1|掉0、余.99999999、HP1、事件0|失败F1|
|A17 目标状态改变|总2伤两段各1，首段D80，读档后D20；预期首段掉0次段掉1、HP0、事件1|两段均掉0，余.99999999、HP1、事件0|失败F1|

## F1 — 整数生命边界被分量截断改变（P1，阻止模块验收）

最小复现运行 [minimal-repro.mjs](../../../artifacts/tests/TEST-A-R1/minimal-repro.mjs)，证据 [minimal-repro.json.log](../../../artifacts/tests/TEST-A-R1/minimal-repro.json.log) 的F1/F1b。

1. 建立w世界，目标R0/maxHp100/hp1/defense80/resistance20/defeatEligible=true。
2. 施放C2/a0/b0，物理和火术分量权重均.5，单段真实命中。
3. K40，物理保留40/120，火术保留40/60。未触发任何上限，无墙、个人盾、易伤或减伤。期望floor(1/3+2/3)=1，HP0并提交一次死亡事件。
4. 实际两个分量盾前值为.33333333与.66666666，carry=.99999999，HP仍1、events=[]。

同样用C2、两段.5的纯物理技能，第一段D80后JSON读档并将目标D改20，仍产生同一漏杀。不是非法存档：目标当前抗性允许由适配层改变，读取目标现态本就是接口合同。A14还说明同通道总量3拆为三个1也会少1HP，而整次或两个1.5不会。

冻结实现 `index.mjs` 的 `beforeShield = ... / ...` 在每个分量处截为8位，然后fractional只累积这些已截断值；更细的余数已经丢失。开发报告已说明每分量1e-8截断，本报告不把这个说明隐去：**但它会改变19章“生命最后取整、多段余数”下的整数生命和死亡提交，不只是不可见显示误差，因此本轮不予放行。** 交总控和开发处理精度合同及实现；不建议靠任意epsilon或每段最少1修补，因为会产生其他边界膨胀。

## F2 — 同分段重试的新hitId没有纳入冲突账本（P2，阻止合同验收）

同一最小复现输出F2：无防目标100HP，C2分为两段；h0结算段0后HP99。alias重试段0返回duplicate=true，但state.hits只记录h0。JSON重载后再次用alias请求段1，本应“相同ID不同请求抛冲突”，实际error=null、duplicate=false、HP从99降98。

定位 `resolveHit`：先查hitId；随后以castId/targetId/segment找到prior时直接返回旧state，未登记alias与请求签名。第二次alias因此被当作新ID。**此问题没有突破同施放同目标同分段次数或总预算；失败点是已接受ID的幂等/冲突语义不完整，不能夸大为无限重复伤害。** 原state没有被就地修改，但函数返回了按合同应拒绝的有效新state。

## 规格笔误、接口假设及未覆盖边界

第19章241例中，`497.24×2/3×1.1×.8`精确为291.714133333…，不是291.714666…。开发指出的笔误成立，最终241正确；此项不是实现失败，主文档由总控修订，本测试未写主目录。

本次调用并验了全部公开核心API：masteryMultipliers、passiveMultiplier、baseResource（经属性/施放路径）、computeAttributes、snapshotSkill、effectiveDefense、personalShields（经目标规范化路径）、resolveDamage、supportAmount、createCombatState、commitCast、resolveHit、interruptCast、awardPractice。仅新增测试辅助函数，没有新增产品API。

尚未覆盖/不能据此宣称完成：UI与3D、帧率/真实碰撞/H5遮挡时序、扫描/闪避/相机、共享场景几何盾的跨目标权威耐久、DOT/抗控账本、三清双分身与临时生命层、学习资格/冷却适配、任意不可信存档迁移、超长casts/hits账本回收、B/C库存奖励及世界刷新原子提交。主游戏接线和实机操作尚未进行，本任务没有启动场景。

跨模块仍假定事件与新combat state由总控适配层原子保存，世界模块消费已提交事件；死亡事件不等于发材料，defeatEligible由适配层明确给出。F1漏死会使后续世界模块收不到本应发生的事件；没有伪造事件或代替B/C测试。

交付后停止扩展。下一步：总控退回DEV-A修复并冻结新版本，另建独立复测会话；通过后才进行集成和联动/场景验收。本测试不自行修复实现、不提交、不集成。
