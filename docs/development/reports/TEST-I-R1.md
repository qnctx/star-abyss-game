# TEST-I-R1：DEV-I-R1 根事务与真实 IndexedDB 独立验收

2026-09-12。结论：**通过（同根存档联动模块范围）**。开发 Node 回归 13/13；独立 Node 10/10；独立真实浏览器 IndexedDB 10/10；开发浏览器回归 6/6。局部入口六个业务按钮均实际点击，真实刷新后完整根 JSON 逐字一致。未发现本轮输入下的实现失败或阻塞；不代表 3D 游戏已经接通。

## 身份、权威来源和测试版本

- 本测试正式任务：`01a094e7-7175-7362-8dbf-878bcc485e6a`；总控：`01a094be-fe94-7c23-9b24-13f777c81d8d`。
- 测试工作区：`C:/Users/HUAWEI/.codex/worktrees/62b6/star-abyss-game`，detached HEAD，`5fdb455d3c46601ebd584e64bcf72a2b5c82baf4`。默认 HEAD 仅为工作区元数据，**没有测试默认分支上的实现**。
- 先读取 `E:/myProject/star-abyss-game/docs/development/CONTROL.md`（包括 DEV-I 全节）；实际祖先规则为 `C:/Users/HUAWEI/.codex/AGENTS.md`，内容与任务给出的规则一致。仓库文件搜索未发现另一份仓库内 AGENTS。工具目录无 codegraph，使用 rg 和局部源码范围。
- 唯一被测交付：`C:/Users/HUAWEI/.codex/worktrees/c0e3/star-abyss-game/artifacts/deliveries/DEV-I-R1`。清单标记开发来源 `7737`，开发正式 ID `01a094d9-4b8a-7890-a238-0effc66ca873`。
- 完成全部 20 项 SHA-256 和字节核验后，复制到本工作区 `artifacts/tests/TEST-I-R1/frozen/`，再读其 `docs/development/reports/DEV-I.md` 和 `playable/src/d3-session/version.json`。12 项 delivery、7 项 dependency、1 项 manifest 均保留原字节。
- 外层 manifest.json SHA-256：`ec2cf824a10cdad30abe417dc7d55edf2ff6f0b60ba1ca38581c849896e67232`。
- 根协调器 index.mjs：`957137435aa500781190588921975d5a052b84816dc8ba6d1edb2487f4f99f4e`；indexeddb.mjs：`60e180a2e4485b567b99c4cd42d7b65f2fc75b8b6fcbd65007620cf217236309`；version.json：`6b661c9f6805e803d6bf84b298ce717b27abffdff53f16f955bd7f90288b96d8`。

完整 20 项相对文件名、角色、字节、预期及实测哈希见 [初始核验](../../../artifacts/tests/TEST-I-R1/hash-verification.json)、[冻结清单](../../../artifacts/tests/TEST-I-R1/frozen/manifest.json)、[最终审计](../../../artifacts/tests/TEST-I-R1/final-audit.json)。最终审计逐项重读原交付与测试副本，20/20 相同；还通过独立 HTTP 源读取所有 .mjs，响应 SHA-256 全部与冻结一致。

7 项只读依赖为 d3-combat/{fixed,index}.mjs、d3-inventory/index.mjs、world-director/{definitions,director,rng}.mjs、world-director/verification/replay-r1.cjs。最后一个随清单保留、核验，没有运行。未覆盖或修改 A/B/C，也未运行主包构建。

## 测试目录、命令、端口和真实退出码

以下命令 cwd 均为测试工作区，使用 cmd.exe、Node v22.14.0：

```bat
node artifacts/tests/TEST-I-R1/verify.cjs
node --test artifacts/tests/TEST-I-R1/frozen/playable/tests/d3-session.test.js
node artifacts/tests/TEST-I-R1/run-node.cjs
node artifacts/tests/TEST-I-R1/server.cjs
node artifacts/tests/TEST-I-R1/audit.cjs
```

|执行|实际结果|证据|
|---|---|---|
|verify.cjs|退出 0；20/20|hash-verification.json|
|直接开发 Node 回归|退出 0；13/13|任务工具输出；随后 run-node 保存同一回归 TAP|
|最终 run-node.cjs|退出 0；开发 13/13，独立 10/10|developer-node.tap、developer-node-exit.json、independent-node.json、independent-node-exit.json|
|server.cjs|成功监听；长期服务无自然退出码|server-info.json：PID 23800，端口 1987|
|真实浏览器独立套件|10/10；POST 200；浏览器套件没有进程退出码|independent-browser.json、independent-browser-final.png|
|冻结开发浏览器套件|6/6；POST 成功|developer-browser.json、developer-browser.png|
|audit.cjs|退出 0；原文件、副本、HTTP 模块哈希和结果均通过|final-audit.json|

初始准备有一条 `node -e` 因 cmd 引号解析退出 1，带空格搜索模式的 rg 命令因同类问题退出 2；改用自己目录的 .cjs 读取和无空格精确搜索后完成。它们不是实现用例失败，不计入通过数。最初独立 9/9 后补齐 amountExact 显式覆盖，最终 10/10；保留初次浏览器结果 independent-browser-initial-nine.json。没有修改实现来获得通过。

服务器仅绑定 `127.0.0.1`，通过 `listen(0)` 让操作系统分配未占用端口，本轮实际为 **1987**。实际入口：

- 独立输入套件：`http://127.0.0.1:1987/`。
- 冻结开发回归与局部操作：`http://127.0.0.1:1987/frozen/playable/src/d3-session/verify.html`。
- served root：本工作区 `artifacts/tests/TEST-I-R1/`；被测源 root：其 `frozen/`。

未运行原 serve.cjs、finalize.cjs 或会覆写冻结的依赖复制器。新服务器将所有 POST 写到自己的证据目录；开发页面虽然仍显示原文“已写入 d3-session/browser-evidence.json”，实际由测试服务器存为 TEST-I-R1/developer-browser.json，原冻结证据未变。仅对返回的 verify.html 追加只读 DOM 观察脚本 manual-recorder.mjs，用于记录按钮完成后的展示根；不修改磁盘 HTML、产品模块、数据库读写逻辑或 A/B/C。脚本不伪造点击或测试结果。

复跑启动服务器可能获得另一个端口，应以 server-info.json 为准。不同 origin 有独立 IDB，不能改用 4177 或任何 DEV 服务器来重现本轮存档。

## 独立输入与逐项预期/实际

用例位于 [independent.mjs](../../../artifacts/tests/TEST-I-R1/independent.mjs)，直接 import 冻结产品 A/B/C 和协调器，不 import 开发 demo-fixture 或 browser-verifier 作为独立输入。新世界种子；铜 2 份、石英 3 份；2 只 HP=2、防御 80 怪物；攻击 8，分段权重 0.125/0.375/0.5；每只两种掉落各 3/2 份；独立唯一物 U-test/u-test-item/u-test-root；两个有限包与一个 0 格满包；另有 1 点个人盾目标。授权检查 worldId、事务前缀和动作集合；拒绝/异常/延迟场景单独注入。空间仍是明确逻辑夹具，不是 3D 空间真实性证明。

Node 使用明确的内存 CAS，只验证协调边界；浏览器使用相同独立用例的 **globalThis.indexedDB 产品适配器**。没有 fake-indexeddb，没有以固定 true 代替真实持久化。浏览器 UA：Windows 10 x64，Chrome/152.0.0.0；记录的真实工厂类型为 `[object IDBFactory]`。

每个成功请求保存完整 before/after/request/result，并检查返回根与重新 load 的完整根一致、JSON 往返一致；拒绝检查完整根 canonical 相等，不只比 revision 或库存数量。并发失败比较保存的胜者完整根。独立浏览器最终 53 条步骤证据。

|独立组|预期|实际（Node / 真实 IDB 均通过）|
|---|---|---|
|01 多种有限资源、最后采收、时间、新代|5 份生成；部分采 1 后 B/C 剩余 4；最后两行 transfer 同根耗尽；put 后 abort 不动全根；令牌时间等于请求根时间；冷却前/倒退拒绝，新代真实 ID|全部相符；保留既有事件/收据，旧资源 ID 与新代不同，新物资 sourceInstanceId 对应 C 返回 ID|
|02 A 死亡、alias、掉落、新怪代|逐次 A 返回完整 state 原样保存；首段 carryExact=1/3；alias 生成新 hits 状态但不重发；两次死亡各 1 事件；两次致死 put 后 abort 全根不变；第一只死无空缺、最后一只死产生令牌|全部相符；HP 实际归零与 C consumed 同根；生成时固定的两类掉落清单逐项保持；满包 slotsFull 整根不变，随后可拾取；新代真实成员 IDs 映射 A actors/drops，旧尸体清单及事件保留|
|03 唯一物双向真实转移|abort 不改变 B 原物与 C owner；bag1→bag2→bag1 后身份和 rootArtifactId 不变|B/C owner p1→p2→p1 同步；事件数组为空；未复制唯一物|
|04 两个独立连接并发|同 revision 的两条最终采收只有一条获胜|一个 fulfilled、一个 rejected；完整持久根等于胜者返回值，revision 只 +1、耗尽事件 1、总资源数量仍 5|
|05 afterCommit 丢响应→重开→后续进度→原请求|采收已保存但抛 responseLost；关闭连接重开后继续唯一物转移；原请求重放不能重发或覆写；复用 ID 改时间/版本/payload 拒绝|新连接读到已保存采收；后续 owner=p2 保持；replayed=true、events=[]、完整根等于最新状态；三种篡改均 transactionIdConflict 且全根不变|
|06 异步授权/取消/调用方隔离|授权 false/throw、授权期间 abort 无写；等待授权时修改调用方对象不影响已复制意图|accessDenied/auth-test-error/cancelled；全根不变；调用方把目的地改成 full 后原复制意图仍合法提交 bag2|
|07 授权等待中的并发|另一请求先提交后，旧意图 CAS 必须失败，不能写回旧子态|commitRejected；完整根与先提交的 spawn 胜者完全一致|
|08 子模块错误|先合法唯一转移、后满包错误不能漏出第一个操作；非法 A 命中和伪造事件不能保存|slotsFull/cast absent/accessDenied；每次完整根相等|
|09 配置与预取消|无 materialize、async materialize、资源数量错误、预先取消全部拒绝|materializerRequired/invalidJson/resourceCountMismatch/cancelled；完整根不变|
|10 显式 amountExact|1 点个人盾吸收 1/3 后精确剩余 2/3；第二击 put 后 abort 保留；关连接重开、alias 新态继续保留；再真实第二击|amount='0.66666666' 且 amountExact=2/3；abort 后全根相同；重开/alias 后仍 2/3；第二击后 amountExact=0/1，carryExact=1/3；B/C/events 无无关变动|

以上 abort 均由冻结适配器的 fault('afterPut') 返回 abort，实际执行 IDBTransaction.abort；“丢响应”在真实事务 oncomplete 后触发。只是故障注入，不声称执行了浏览器断电或进程崩溃。完整 A 对比以真实 resolveHit 的返回态为对照，并另显式断言 carryExact 和 amountExact；没有重新实现 A 算法或替换它。

## 实际局部按钮与刷新证据

CUA 实际操作记录和截图保存到测试目录，未用 DOM evaluate 调用产品函数来替代按钮。先点独立运行按钮和开发故障套件按钮；开发 6/6 仅回归，不替代上表。随后顺序执行：

|实际按钮/动作|实际状态|文件|
|---|---|---|
|初始化 / 重载演示存档|revision 0、events 0|manual-1.json|
|生成一处资源|revision 1、events 0|manual-2.json|
|采收一份|revision 2、events 0，资源还剩 2|manual-3.json|
|生成怪群并击败一只|spawn/cast/3 次 hit；revision 7、累计死亡事件 1|manual-4.json|
|拾取尸体清单|revision 8；物资进入 pack，死亡历史清单保留|manual-5.json|
|转移完整唯一物|revision 9；原物在 other-pack，C owner=other|manual-6.json|
|展开完整权威根快照|读取完整 #state 文本存刷新前文件|manual-before-refresh.json|
|真正 tab.reload，再点击初始化 / 重载|revision 9；新 pageInstance；完整 JSON 逐字相同|manual-7.json、manual-after-refresh.json、refresh-proof.json|

截图：[独立最终 10/10](../../../artifacts/tests/TEST-I-R1/independent-browser-final.png)、[开发回归 6/6](../../../artifacts/tests/TEST-I-R1/developer-browser.png)、[业务按钮操作后](../../../artifacts/tests/TEST-I-R1/manual-before-refresh.png)、[刷新重载后](../../../artifacts/tests/TEST-I-R1/manual-after-refresh.png)。当前约 1280×720 视口中文可读、按钮无覆盖/截字，所有按钮均可点击；日志和长 JSON 可滚动。未做其他尺寸或手机适配验收。

手动按钮层未点击到“最终一份采收”、最后一只怪物耗尽或满包拒绝；这些由独立浏览器新输入真实 IDB 套件执行。不得把它们描述成手动按钮已操作。未执行任何游戏主入口、3D 战斗、相机、真实距离/路径、安全体积、宠物或 NPC 抢夺操作。

## 失败复现、兼容边界与移交

**实现失败：未发现；阻塞：无。** 因此没有实现缺陷的最小失败复现。预期故障最小复现：生成本测试 2+3 有限资源→部分采 1→对最后两行 transfer 开启 afterPut abort→execute 抛 injectedAbort→重新 load 的整个根与之前完全一致；关闭 fault，原请求可成功。同样的模式用于致死 hit、唯一物 transfer 和含 amountExact 的 hit。具体最小请求、之前/之后根与异常均在 independent-browser.json 对应组 steps。

通过范围只限冻结 A-R2/B-R1/C-R2 依赖与本次 DEV-I-R1 的同根 API：createRoot/validateRoot/createSession/copy/canonical、openIndexedDB 返回的 initialize/load/compareAndSwap/close；没有增加产品导出。传入的 storage、同步空间判断、确定性 materialize 和授权仍由未来场景适配器负责。完整唯一物已登记的初始库存是测试创作状态，不伪称为运行时掉落来源。

未验证浏览器整个进程关闭、跨浏览器/跨设备、配额耗尽、存档损坏/迁移、旧 A-R1 档案补偿、长时间增长和历史清理。两个连接是同一浏览器 origin 的两个独立 IDB 连接，不是两个浏览器进程。仅支持声明的 spawn/cast/hit/transfer 切片，唯一碎片重铸、consume、独立子态持久化等不属本轮接入合同。

本任务仅写 `artifacts/tests/TEST-I-R1/` 与本报告；无主目录写入、实现修改、开发证据覆盖、主包构建、提交、推送、收费资源或密钥操作。服务器仍提供本地复核入口，产品源与副本保持冻结。总控可据此进入自有文件集成审计，再独立安排 DEV-D 真实场景切片；本测试不自行集成或扩展。
