# TEST-I-R2：冻结 DEV-I-R2 场景 checkpoint / 同档保包 rescue 独立验收

2026-09-12。结论：**通过（同根存档模块范围）**。开发 Node 14/14，第14项是含7组的wrapper，不能计为另加7个Node test；原 TEST-I-R1 独立用例在R2上 Node 10/10、真实IndexedDB 10/10；本轮新编R2独立用例 Node 10/10、真实IndexedDB 10/10；冻结开发浏览器七组7/7。真实点击初始化、A致死链、救援、后续位置与唯一物转移；实际刷新后完整根一致。没有发现本轮输入下的实现失败或阻塞。**这不是D1 3D验收，也不表示已接入现有主游戏。**

## 身份与精确版本

- 本测试正式ID：`01a09502-a1f9-7863-a3e0-5f55cdaff6de`；总控：`01a094be-fe94-7c23-9b24-13f777c81d8d`。
- 测试工作区：`C:/Users/HUAWEI/.codex/worktrees/3060/star-abyss-game`；detached HEAD `5fdb455d3c46601ebd584e64bcf72a2b5c82baf4`。初始工作区干净；基线仅作身份记录，未测默认基线实现。
- 被测冻结源：`C:/Users/HUAWEI/.codex/worktrees/c0e3/star-abyss-game/artifacts/deliveries/DEV-I-R2`。
- manifest指向开发工作区 `C:/Users/HUAWEI/.codex/worktrees/7737/star-abyss-game`，开发正式ID `01a094d9-4b8a-7890-a238-0effc66ca873`，version-r2冻结时间 `2026-09-12T09:44:56.402Z`。
- 先读权威 `E:/myProject/star-abyss-game/docs/development/CONTROL.md`，含I-R2救援取舍，再读实际 `C:/Users/HUAWEI/.codex/AGENTS.md` 与主项目TEST-I-R1报告。仓库搜索未发现额外AGENTS。CodeGraph可执行但本工作区未初始化，改用精确搜索、局部源码读取。
- **先全量核验33项SHA-256与字节，再复制同哈希副本到 `artifacts/tests/TEST-I-R2/frozen/`，然后读取冻结DEV-I.md和version-r2.json。** 33项含26自有文件（其中version-r2角色manifest）和7只读依赖；加外层manifest自身共34文件。

|关键文件|SHA-256|
|---|---|
|外层manifest.json|`da8488b293663cc45a23e502c2c144d2b48dabdffabbd5b7b803d5821a3c9f18`|
|d3-session/index.mjs|`ef2a19df4ee209864cf318df0e87b6e36673ef14f8cc3913362bfed879e0c687`|
|d3-session/scene.mjs|`f7d5c9a1fd5d5a9075a5d064af65c032f4db08e818a6dabbead02fbeb430a0a2`|
|d3-session/indexeddb.mjs|`60e180a2e4485b567b99c4cd42d7b65f2fc75b8b6fcbd65007620cf217236309`|
|d3-session/version-r2.json|`b4c6f9336ff7e6c787b0eb85fec0b1e8f44e25316c4c913bf3dd806a0acc3df7`|

完整路径、角色、预期/实测字节及哈希：[hash-verification.json](../../../artifacts/tests/TEST-I-R2/hash-verification.json)、[冻结manifest](../../../artifacts/tests/TEST-I-R2/frozen/manifest.json)。最后审计34/34源/副本一致，HTTP读取的全部冻结.mjs也逐项匹配：[final-audit.json](../../../artifacts/tests/TEST-I-R2/final-audit.json)。未修改冻结源、测试副本或只读依赖。

7只读依赖为d3-combat/{fixed,index}.mjs、d3-inventory/index.mjs、world-director/{definitions,director,rng}.mjs及world-director/verification/replay-r1.cjs。最后一个仅核验、未运行。

## 命令、入口、证据隔离与真实退出码

下列命令cwd均为本测试工作区，shell为cmd.exe，Node v22.14.0。未运行serve/finalize/依赖复制器的原开发脚本。

```bat
node artifacts/tests/TEST-I-R2/verify.cjs
node artifacts/tests/TEST-I-R2/prepare.cjs
node artifacts/tests/TEST-I-R2/run-node.cjs
node artifacts/tests/TEST-I-R2/server.cjs
node artifacts/tests/TEST-I-R2/audit.cjs
```

|执行|实际结果|证据|
|---|---|---|
|verify.cjs|退出0；33清单项及manifest复制相同|hash-verification.json|
|prepare.cjs|退出0；复制原TEST-I-R1 independent.mjs，原字节不变|r1-provenance.json|
|run-node.cjs|退出0；开发14/14、R1 10/10、新R2 10/10|developer-node.tap、developer-node-exit.json、node-exit.json、r1-node.json、independent-node.json|
|开发第14项内七组|7/7；同一次Node wrapper执行|developer-seven-node.json|
|server.cjs|成功监听PID30768；长期服务无自然退出码|server-info.json|
|独立真实IDB|R2 10/10（144步骤）、R1 10/10（53步骤）；证据POST200|independent-browser.json、r1-browser.json及截图|
|冻结开发页面|实际点击七组，7/7（64步骤），POST200|developer-browser-seven.json、developer-browser-seven.png|
|audit.cjs|退出0；34文件一致、HTTP哈希一致、刷新证据及套件结果均通过|final-audit.json、refresh-proof.json|

原开发Node测试末尾会写其源码目录的scene-node-r2.json。本测试通过自己的 [redirect.cjs](../../../artifacts/tests/TEST-I-R2/redirect.cjs) 精确重定向这一个fs.writeFileSync目标为TEST-I-R2/developer-seven-node.json；原测试文件、import、断言、业务实现及存储适配器均未修改。实际子命令是 `node --require artifacts/tests/TEST-I-R2/redirect.cjs --test artifacts/tests/TEST-I-R2/frozen/playable/tests/d3-session.test.js`，由run-node记录TAP与status。预加载器不是fake-IDB，也不修改断言结果。

原R1测试直接取自 `C:/Users/HUAWEI/.codex/worktrees/62b6/star-abyss-game/artifacts/tests/TEST-I-R1/independent.mjs`，原文件与本轮副本SHA-256均为 `64106b46ed943af686cea3b60df08b012e4bf05062f947cdff20373580d02734`。它的原import恰好解析至本轮frozen，无需替换；未调用旧TEST的写证据脚本。

本轮自己的server只绑定127.0.0.1，通过listen(0)分配端口，实际 **45564**。served root严格为本工作区 `artifacts/tests/TEST-I-R2/`；所有POST白名单只写该目录顶层，开发页面请求也由本服务器另存为自己的证据。没有使用4177、4180或DEV服务器。

- 独立入口：`http://127.0.0.1:45564/`。
- 原冻结开发入口：`http://127.0.0.1:45564/frozen/playable/src/d3-session/verify-r2.html`。

新启服务会获得新端口，复核以server-info.json为准；更换origin会对应不同浏览器IDB。服务仍在运行供总控只读复核。

准备过程有无匹配文件的rg退出1；一次带空格pattern的cmd/rg搜索因引号解析退出2。它们不是产品测试失败，不计入用例。所有正式验证命令退出0。首次新用例完成后补强resource从17恢复至100、异步rescue竞争，最终已在Node及真实IDB重跑为本报告版本；没有修改实现来获得通过。

## 独立输入与逐项预期/实际

[independent.mjs](../../../artifacts/tests/TEST-I-R2/independent.mjs) 是本轮新编断言；直接调用冻结createSession/resolveHit/baseResource。使用上一轮独立fixture的A/B/C创作数据，未使用开发demo-fixture作为新独立测试依据：p1/p2有限包、0格满包、完整唯一物U-test、铜2/石英3、两名HP2成员、个人盾1的独立actor。R2新输入设玩家resource=17、安全点x=-7.25,z=13.75,yaw=-0.75,pitch=.15；敌人攻击900；真实玩家攻击保留1/3 carryExact、独立盾剩2/3 amountExact；保留一具未拾取尸体和耗尽后真实新资源代际。

授权按worldId、r2-事务前缀及动作白名单检查，拒绝/异常/取消/等待分别注入。空间仍为明确逻辑夹具，不能证明3D空间安全。Node仅用显式内存CAS；浏览器直接使用globalThis.indexedDB与冻结openIndexedDB，记录工厂为`[object IDBFactory]`，UA为Windows Chrome/152.0.0.0。不存在fake-indexeddb或用固定true模拟持久化。开发固定授权夹具七组仅计开发回归。

成功步骤记录完整request/before/after/result，并比较返回根与重新load根；拒绝记录完整根并比较canonical相等；并发比对完整胜者根。独立Node与IDB每种最终144步骤。Infinity/NaN拒绝请求在JSON证据中显示null，原输入构造及期望错误在independent.mjs中可复跑，不能以JSON的null误述实际输入。

|独立组|预期|Node / 真实IDB实际|
|---|---|---|
|01 严格scene|未知/缺字段、错误version/time、HP夹带、x/z闭边界、yaw/pitch越界、Infinity/NaN、错误actor/显示名ID、未知cast、计时越界、31日志/201字/未来日志、额外字段、超长ID、超规模map拒绝；合法极限通过|全部符合；拒绝全根相等；合法scene只改scene、根时间/revision/收据，A/B/C/历史不变；30×200字日志和有效边界位置保存|
|02 业务附scene原子|真实cast、hit、唯一物transfer先计算，非法scene则业务全回滚；同样合法请求可共同保存|三种非法scene均invalidSceneFields且全根相同；合法cast新pending、真实A盾吸收结果、B/C owner到p2分别与scene同一次根提交|
|03 配置和请求注入|活玩家、无scene、无sceneConfig拒绝；rescue夹带actorId/hp/坐标/scene/sceneConfig拒绝|playerNotDefeated、sceneConfigurationRequired、invalidSceneFields；无请求可修改固定救援对象和恢复值|
|04 无真实致死证据|初始HP0且无A致命记录，即使scene已建立也不能救援|defeatEvidenceRequired；全部根不变；该零HP创作态只用于拒绝测试，未称其为真实败北|
|05 真实A致死救援|同玩家ID的HP0恢复maxHp，resource17恢复基础100；其他所有A字段/B/C/库存/尸体/代际/唯一账/事件和收据历史保持；旧cast新段不能命中|完整combat与只改恢复字段和cast.interrupted的预期逐字段相等；amountExact 2/3及carryExact保留；安全点固定、pending/cooldowns/hurt清空、enemies/logs保留；旧段interrupted；新ID再次rescue活玩家拒绝；原rescue重试只返回最新根|
|06 abort/丢响应/进度重试|checkpoint及rescue在真实put后abort应全根不变；rescue提交后丢响应，重开连接，后续移动/转移/受伤，再原rescue重试不得回血或回站|injectedAbort后完整根相同；responseLost后新连接见已提交救援；后续x11,z-20、唯一物在bag2、fresh cast造成新伤害均保留；replayed=true/events=[]；篡改原事务时间报transactionIdConflict|
|07 两连接与异步竞争|异步授权rescue等待时checkpoint先提交，旧rescue不能覆写；两连接rescue只能一胜；异步checkpoint等待时真实转移先提交也不能覆写|两种等待竞争均commitRejected且完整根等于新态；迟到rescue未回血（仍HP0）；两个独立连接一成功一拒绝、根revision只+1，无双重救援|
|08 取消/授权/调用方隔离|false、throw、预取消、授权期间取消全无写；会话配置深拷贝，等待中调用方改playerId/safePoint或req actorId不得改变已接受意图|accessDenied/test-authorize/cancelled，完整根相同；配置被改成shielded/x22仍只恢复p1并回原固定点；请求在execute进入时复制有效|
|09 重复死亡与历史重试|真实死亡→救援→新cast再次真实致死；旧救援收据重试不能把第二次死亡救起；新事务才能第二次救援|A历史有两条真实p1致死；旧请求返回当前HP0死态，不回血、不写；新rescue恢复45，保留第二次死亡后的全部历史与业务资产|
|10 旧无scene根与checkpoint去重|R1根合法转移后仍无scene；checkpoint提交丢响应重开，后续位置改变后原请求重放不能回滚|符合；旧业务未被自动加scene；丢响应原收据可读；后续x=-15保持，重放完整根等于最新根|

原R1独立十组完整复跑内容不作合并计数：多资源最终耗尽/时钟/新代；A exact/alias/死亡/尸体/新成员；唯一物双向与abort；两连接CAS；丢响应重开后业务与原请求；授权/取消/请求复制；等待授权并发；子模块错误回滚；工厂配置与预取消；amountExact跨abort/重开/alias保留。每组Node/IDB均通过，其完整请求与预期实际见r1-node.json、r1-browser.json。

## 实际点击、截图与真正刷新

通过CUA对可见按钮执行真实click，未使用evaluate调用产品函数代替点击。页面按钮内部执行真实模块事务，每个业务步骤POST完整before/after。顺序如下：

|实际操作|实际状态|证据|
|---|---|---|
|独立R2十组按钮|最终10/10，144步骤|independent-browser.json、independent-browser-final.png|
|原R1十组按钮|10/10，53步骤|r1-browser.json、r1-browser.png|
|初始化/重载|revision0，p1 HP45，尚无scene|manual-1.json|
|执行真实A致死链|revision13，p1 HP0/45，events2（资源耗尽+成员死亡），已有未拾取尸体/新资源代际|manual-2.json、manual-defeated.png|
|同档固定点救援|revision14，p1 HP45/45，位置(-7.25,13.75)，events仍2|manual-3.json、manual-rescued.png|
|后续位置和唯一物转移|revision16，位置(10,-21)，唯一物到bag2，events仍2|manual-4.json、manual-before-refresh.png|
|tab.reload后再实际点击重载|新pageInstance，navigationType=reload，revision16；完整根JSON与manual-4.after逐字相同|manual-5.json、manual-after-refresh.png、refresh-proof.json|
|冻结开发验证入口七组按钮|7/7；真实IDB，POST另存测试目录|developer-browser-seven.json、developer-browser-seven.png|

手动存档创建于resource补强之前，因此手动链的resource原本100；**resource17→100证明来自最终独立Node/IDB套件，不冒称手动按钮也执行了这个初值。** 手动链未实际操作3D输入/走位/受击动画，“执行真实A致死链”是局部存储事务按钮，不能称为玩家真实在3D输掉战斗。

当前约1280×720页面截图中中文可读、按钮能点击，没有重叠和截字；长日志及根JSON可滚动，未验收其他设备尺寸。

## 失败、兼容边界和交回总控

实现失败：未发现。阻塞：无。无实现缺陷的最小复现。预期故障最小复现：运行prepareDeath建立合法scene及真实A致死根→构造rescue→fault在afterPut返回abort→execute抛injectedAbort→重新load全根等于之前；关闭fault原请求可成功。第06组保存了准确请求与全量前后根。afterCommit丢响应仅模拟“事务已提交、调用方未收到成功”，未模拟断电或整个浏览器崩溃。

已测历史边界：救援后活玩家不能新事务再救；再次真实死亡可新事务救；旧救援重试永远只返回最新态，即使当前再次死亡也不会回血；旧未结算cast中断、历史命中/事件/根收据保留。实现以“当前HP0 + 任一历史非alias A致死记录”确认救援资格，并不独立维护死亡epoch或防篡改证明。本验收针对受信初始根与公开execute产生的后续状态，**不将其解释为任意外部编辑combat.hits/HP后的存档安全验证**。未直接改持久根来冒充运行期救援。

R1无scene根可兼容使用原业务；建立scene必须配置。scene v1是严格结构，未知/null/不完整旧scene不属自动迁移；建立scene后不能假设旧R1写入器继续写仍正确。没有验证损坏档迁移、历史裁剪、配额耗尽、浏览器进程关闭、跨设备/跨浏览器或长期增长。两连接是同一origin两个真实IDB连接，并非两个浏览器进程。装备相关保留采用实际根内字段和完整库存比较；不代表未实现的耐久或后续经济扣损模型已测试。

测试覆盖导出API：createRoot/createSession/validateRoot/copy/canonical、R2 validateScene/validateSceneConfig（配置验证经createSession执行）、openIndexedDB.initialize/load/compareAndSwap/close。未新增产品导出。空间、授权、materialize及可信初始根仍是场景适配契约。D1下一步应按已验证的固定sceneConfig接checkpoint/rescue，经execute写根，使用权威返回态恢复；需另行真实3D战败/救援/碰撞/输入验收，不得借本报告标主游戏已实装。

本任务只写自己的artifacts/tests/TEST-I-R2目录及本报告；修改清单包含测试驱动/新用例/只读冻结副本/JSON/TAP/截图。没有修改被测实现、开发证据、主项目或A/B/C，没有构建game.js、收费/密钥、提交或推送。完成后发总控并停止扩展。
