# DEV-B 库存事务模块交付

2026-09-12。状态：**开发者自测17项通过；等待独立 TEST-R1 测试与总控判定，尚未通过最终模块验收；主游戏尚未实装。**

总控迁移后状态修正：新总控任务为 `01a094be-fe94-7c23-9b24-13f777c81d8d`，权威主目录仍为 `E:/myProject/star-abyss-game`。此前“模块验收通过”措辞不准确，本次仅修正报告文案；实现和测试文件冻结，不自行集成或扩展。收到独立失败报告后才按新总控安排修复，每轮交由另建独立任务复测。

## 工作区与依据

- 工作区：`C:/Users/HUAWEI/.codex/worktrees/bb9f/star-abyss-game`
- 分支：detached HEAD；基线 `5fdb455d3c46601ebd584e64bcf72a2b5c82baf4`。未创建提交、未推送。
- 已从主项目 `E:/myProject/star-abyss-game/docs/development/CONTROL.md` 读取最新总控，并阅读主项目 cultivation 的 03、10、12、27、28；27 的消耗后换代规则优先于10旧过期描述。
- 主目录只读。没有修改主入口、公共资产、package.json、构建产物或其他任务目录。没有收费生成。
- codegraph 已尝试；当前独立工作区未初始化索引，故以新模块局部阅读和定向测试完成，没有创建越界索引文件。

## 改动文件

- `playable/src/d3-inventory/index.mjs`：无依赖 ES module，可供浏览器模块与 Node import。
- `playable/tests/d3-inventory.test.js`：Node 内置 test，17项测试。
- `docs/development/reports/DEV-B.md`：本报告。

## 已完成切片

普通物品按定义ID、T、Q、状态、可堆叠属性和物理参数匹配合堆；合堆只节省格数。部分转移和显式同容器拆分生成确定性 splitId，保留 rootItemId；混合来源用 lots 数量账保留，合堆后不丢来源。全量转移到空位保留原 itemInstanceId；普通堆叠合入已有堆时保留目标堆ID，来源在 lots 中追溯。

唯一物 quantity/maxStack 均为1，转移保留 itemInstanceId、uniqueDefinitionId、rootArtifactId。重复唯一定义导入抛 uniqueConflict，不静默删除；禁止当普通消耗品或可再生资源配置。这里不创建唯一物发放资格，不提供原器拆片/重铸；初片范围只支持完整唯一物原ID流转。

格数、体积、内部载重和角色有效负重同时校验。容器外壳与传重系数纳入持有人，角色120%上限采用精确整数比较；已有被动超载存档允许保留和卸货，事务不能进一步增加超限维度。整个多操作事务在最终态检查容量，允许真实换物整理；中间状态不会暴露或持久化。

采集从 kind=resource 容器既有清单扣除并加入有限背包/货舱；部分采集不发事件，取尽清单才标记 depleted 和写一条 resourceDepleted。预览不改变状态，预览事件 committed=false；成功提交后才返回 committed=true 事件。普通服用/加工扣料只写 consume 收据，不冒充刷新空缺。取消预览、容量失败、写入明确失败均不改输入快照。

## 导出 API

|API|输入/输出与职责|
|---|---|
|`InventoryError`|`code` 与 `details`，容量错误区分 slotsFull / volumeFull / massFull / holderOverloaded|
|`createState({worldId,containers,holders?,items?})`|创建 schemaVersion=1、revision=0 快照，标准化物品与来源账；这是初始化/导入入口，不是运行时增发 API|
|`validateState(state)`|检查稳定ID、整数、引用、唯一冲突、来源数量和事件收据；不删除超载旧物|
|`measureContainer(state,containerId)`|返回 slots、volumeMl、massGrams、effectiveMassGrams 十进制整数字符串|
|`measureHolder(state,holderId)`|返回有效质量、安全负重、移动/体耗倍率与疾跑/闪避/起飞许可|
|`planTransaction(state,request)`|返回可 JSON 序列化意图、baseRevision 与容量/变更预览；失败抛错、不锁料、不写状态|
|`commitTransaction(state,plan,{compareAndSwap,authorize?})`|重算意图，不信任预览；显式持久适配成功后返回 `{state,receipt,events,replayed}`|
|`serializeState(state)` / `deserializeState(json)`|验证后 JSON 往返，保留 receipts、outbox、split/provenance 和耗尽状态|

数据合同：

- 容器必填 `containerId,maxSlots,maxVolumeMl,maxMassGrams`；可选 `kind,access,holderId,shellMassGrams,transmissionPpm,sourceInstanceId`。毫升/克均为非负十进制整数字符串，内部 BigInt 精确计算；格数/数量是安全整数。传重系数百万分整数，传给角色的不足1克部分向上取整。资源实例ID不得复用。
- 持有人必填 `holderId,safeCarryGrams`，可选 `baseMassGrams`。每个容器只能归一个 holderId；baseMassGrams 应含外穿装备等未由容器计重的质量，调用方不能再重复放入已计重内容。容器不能嵌套。
- 物品必填 `itemInstanceId,containerId,definitionId,quantity,maxStack,unitVolumeMl,unitMassGrams`。调用方给材料20、丹药10、灵石100等堆叠参数；特殊物显式覆盖。可选 T/Q、状态、attributes、slotsPerStack（例如蛋2格）、唯一标识和来源。属性 JSON 中数值只支持安全整数；高阶价值可用字符串保存，不在本模块计算货币。
- 请求为 `{transactionId,expectedRevision,operations:[...]}`。操作为 `transfer(itemInstanceId,fromContainerId,toContainerId,quantity)`、`split(itemInstanceId,fromContainerId,quantity)` 或 `consume(itemInstanceId,fromContainerId,quantity,reason)` 对应字段对象。
- 同事务重试必须使用**完整原请求**，包括原 expectedRevision；改数量或版本但复用同 transactionId 会报 transactionIdConflict。新操作必须新事务ID。匹配已提交收据时忽略旧版本，返回当前快照和原收据，events为空；未发出的已提交事件仍可在 outbox 找到。
- `sealed` 容器、`locked/opened` 物品拒绝操作；cargo/warehouse 内物品不能直接 consume。运行时的位置、货舱距离/停稳、服药条件由接入层检查。`authorize(state,request)` 可注入当前权限检查，true 才继续提交；其本身不替代存储层并发条件。

最小调用顺序：

```js
import { planTransaction, commitTransaction } from './playable/src/d3-inventory/index.mjs';
const request = {
  transactionId: 'harvest-session-1', expectedRevision: state.revision,
  operations: [{ kind: 'transfer', itemInstanceId: 'herb-generation-1',
    fromContainerId: 'plant-stock-1', toContainerId: 'player-pack', quantity: 3 }]
};
const plan = planTransaction(state, request); // 先展示预览，可直接取消
const result = await commitTransaction(state, plan, { compareAndSwap, authorize });
state = result.state; // 适配器成功后才采用并显示结果
```

## 显式提交与其他模块假设

`compareAndSwap({worldId,expectedRevision,nextState,receipt,events})` 必须在真实存储内原子检查版本并写入快照、收据、outbox，完成后才返回 true。false 表示未写；抛异常可能明确失败，也可能已写但响应丢失，调用方应重新读取权威快照并重放原请求，不能盲目回写旧态。

17项测试使用真实内存状态变更的 CAS 适配器验证并发/回滚；**没有实现或验证浏览器跨模块持久原子性**。调用方若传入永远返回 true 的假适配器，本模块无法凭空获得持久化或并发保证。

DEV-C 可从持久 outbox 消费标准 `{eventId,worldId,sourceInstanceId,kind:'resourceDepleted',committed:true}`。事件ID为 JSON 字符串编码的稳定三元组，应作为不透明ID处理。无时间字段，冷却时间需由最终协调器在成功提交边界统一记录。outbox 与 receipts 当前不裁剪；集成层应定义可靠消费确认/压缩协议，不能删去去重依据后宣称重试仍安全。

唯一物转移收据包含原 uniqueDefinitionId/rootArtifactId 与源、目标容器；DEV-C 世界唯一账须由协调器在同一根快照内同步持有位置。本模块只在自己的快照内查重复，不替世界全局唯一账保留/发放资格。

## 真实验证结果与复跑步骤

在上述工作区使用 cmd 执行：

1. `node --test playable/tests/d3-inventory.test.js`：**17 passed，0 failed**。
2. `node --check playable/src/d3-inventory/index.mjs` 和 `node --check playable/tests/d3-inventory.test.js`：语法检查通过。
3. `git diff --check`：无输出；新文件为未跟踪文件，该命令不检查其正文，不将此项冒称完整新文件审查。

断言覆盖：部分采收→最终耗尽→货舱；同事务重发与存档往返；预览取消和持久失败；格数/体积/质量分别满且整批回滚；堆叠属性匹配和真实质量；同容器拆分与 split 来源；唯一物原ID转移；扣药收据与访问限制；角色120%边界/被动超载卸货/法器传重；两方并发争采只一个成功；篡改预览和冲突事务；提交成功但响应丢失后重载去重；超安全整数范围质量精度；30轮搬运数量与来源守恒；唯一物不触发普通再生；异步授权期间快照稳定。

## 未完成边界与下一步

未开发抢劫AI、药效/动画/服药锁定生命周期、金钱交易、炼丹订单、完整袋戒绑定/封存/嵌套规则、载具性能与乘员聚合、原器拆片重铸、场景UI、存档迁移修复或真实浏览器数据库适配。consume 是生效帧最终扣料入口，前置校验/打断/效果与扣料同快照仍由下一片完成；不得据此声称全部丹药已接通。

总控下一步：仅集成这三个文件并复跑定向测试；将场景草药清单映射为资源容器，将人物/货舱映射为独立有限容器；在同一根保存事务内协调库存、唯一账、世界事件；验证真实保存失败/重载，再做采集和双栏转移场景操作验收。DEV-B 到此停止扩展，等待集成。
