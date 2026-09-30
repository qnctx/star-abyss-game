# TEST-I-R3 独立验收

结论：**PASS（同根存储模块范围）**。2026-09-12。仅验 DEV-I-R3 冻结版，不代表原游戏大地图步行、载具或3D整合验收，未修改主项目，主 I-R2 是否升级由总控决定。

版本 SHA-256：`ce42b6d0363105791b0a3a3cae9060221f749b6a7ec8ae7ae4cb51cf1cc742bd`。

唯一来源：`C:/Users/HUAWEI/.codex/worktrees/c0e3/star-abyss-game/artifacts/deliveries/DEV-I-R3`。先读取主 ORIGINAL_GAME_REBASE、CONTROL、HANDOFF 和冻结 DEV-I 报告 R3 顶部。outer manifest 的 47 文件（39 自有、7 依赖、1 版本清单）逐项字节数/SHA 核验后，复制至本工作树 `artifacts/tests/TEST-I-R3/subject`，没有使用旧 HEAD 实现或动态开发目录。工作树 `C:/Users/HUAWEI/.codex/worktrees/5a02/star-abyss-game`，detached HEAD；开始时 git status 干净。结束再次核验冻结源和 subject 全部 47 文件，源码、依赖与历史证据均未改变。

## 计数与证据

|类别|实际结果|证据（相对 artifacts/tests/TEST-I-R3）|
|---|---|---|
|开发 Node 回归重放|15/15 外层测试；其中 R2 wrapper 7 组、R3 wrapper 5 组包含于15，不叠加计数|developer.tap、developer-output/|
|全新独立 Node|9/9 组；内存 CAS，仅用于协调逻辑|independent-node.json、independent.mjs、node-run.mjs|
|全新独立真实 IndexedDB|12/12 组（共享独立9组+原生适配器专属3组）|independent-browser.json、native-browser.json|
|原 R2 真实 IndexedDB 回归重放|7/7 组，已有用例，单列不冒称新独立用例|r2-browser.json|
|真实按钮流程|2/2 完成：运行IDB/救援回归；真正刷新后点击全根重载。运行按钮共点2次，第一次自有证据服务故障不计完成|ui-actions.json、page-reload.json|
|交付身份与未改验证|47/47 冻结源及副本结束一致|outer-manifest.json、initial-hashes.json、final-hashes.json|

所有浏览器根快照通过页面原生 JSON.stringify 后 POST 到本地服务原字符串落盘，不通过工具对象转译，不截断浮点/根记录。最终全根刷新比较使用 canonical 完整字符串。证据文件及报告 SHA 在 evidence-manifest.json，清单本身不自哈希。

## 独立验证矩阵与实际结果

1. 配置严格校验：33 个非法配置变体覆盖 null/空对象/额外字段、六字段各自 NaN/正负 Infinity、每字段缺失、额外 bounds 字段、x/z 倒置或相等、pitch倒置/超±π/2、不安全 safePoint。validateSceneConfig/createSession 均拒绝；原生 open 也验证非法配置拒绝。
2. 玩家与真实生成敌人同坐标开区间：正负 2999.58、2999.999999 接受；x/z 精确±3000及越界拒绝，整根不变。yaw±π、玩家pitch±1.35接受，其外小量拒绝。大坐标根 validateRoot 无config/旧两字段config拒绝。
3. 默认R2保持 x(-24,24)、z(-49,18)、pitch[-.3,.65]。近边缘接受，精确坐标边界/越界、pitch越界和z190拒绝；无config validateRoot 原小图仍通过。
4. adapter/session 的 playerId、safePoint、bounds 分别错配或漏session配置均拒绝。session创建后篡改原配置不生效；原生adapter在open返回前篡改调用方对象仍按初始快照接受大坐标。无config adapter兼容旧两字段session但拒显式大bounds。
5. checkpoint/cast/hit/transfer 的附带scene分别加入 sceneConfig/poseBounds/safePoint/playerId/hp 均拒绝并全根回滚；checkpoint/rescue顶层配置/HP注入拒绝。根自报bounds不能使越界scene通过。
6. checkpoint及救援的afterPut abort完整回滚；afterCommit丢响应仍保存；后续大坐标checkpoint后重试旧收据读取最新根，不回滚后续进度。并发请求仅一根CAS获胜，另一失败且根保持赢家；旧revision新事务拒绝。R2回归还覆盖异步授权竞争、取消/拒绝授权与reopen。
7. 原生适配器load、initialize next、CAS next均拒非法scene，未污染原根；用自有测试DB raw写入非法坐标作为损坏存档夹具后，load/session.load、CAS current和initialize current全拒，非法根原样保留。随后恢复该自有坐标夹具。raw写入仅用于损坏坐标测试，未绕CAS写HP。无config reader读大图失败，raw检查原根不变。
8. 活玩家不可救援；初始导入HP0但无A致死历史的专用world报defeatEvidenceRequired，根不变。该HP0为初始化夹具，不是运行时改HP。
9. 全新闭环真实采集到背包，真实A击杀一敌生成掉落/事件，伤害另一敌，敌人真实A致死玩家；保存(-2750,2890)，救援到同world/同player固定(0,190)。inventory/director/drops/events完全保留，敌人伤势/全部hit历史及先前根收据保留；旧cast全中断，迟到攻击失败。救援丢响应后继续保存(2510,-2710)，旧救援重试不回退，真正页面reload后完整根一致。

## 复跑步骤

在本工作树使用 cmd：

```bat
node --require ./artifacts/tests/TEST-I-R3/preload.cjs --test artifacts/tests/TEST-I-R3/subject/playable/tests/d3-session.test.js
node artifacts/tests/TEST-I-R3/node-run.mjs
node artifacts/tests/TEST-I-R3/server.cjs
```

打开 `http://127.0.0.1:4219/verify.html`，点击“运行独立IDB、救援及R2回归”，等待9/3/7组全true；实际刷新页面，再点击“页面刷新后核验完整根”，预期完整字符串一致。所有数据库/world均有TEST-I-R3前缀或该唯一label及时间戳；未操作他人库。服务只监听本机4219，不复用开发4185，结束停止自有服务。preload仅把开发测试写evidence-r3的输出重定向到developer-output；未运行旧finalize/prepare。

## 缺陷、测试脚本修正与边界

未发现被测产品失败，无源码修复。首次Node独立执行因测试记录器未暴露steps导致3组记录失败，已保存harness-first-run.json，修正自有脚本后9组全量重跑通过。首次浏览器服务POST白名单只允许字母，r2-browser.json含数字而保存失败；保存first-*.json，修正自有服务后整个9+3+7矩阵重新点击执行并落盘，最终刷新通过。两者均为测试基础设施错误，不计产品失败或首次完成。

自定义storage若无assertSceneConfig hook，createSession只能按自身固定配置验证读出的根和业务next，不能证明外部storage的约束或自动拒绝配置错配；宿主必须承担adapter/session一致性及原子持久化保证。本次Node模拟器明确有hook；真实验收针对冻结原生IndexedDB适配器。直接调用adapter CAS是宿主信任边界，不是可向玩家公开的任意写根/改HP接口。

空间授权与materialize使用明确逻辑夹具，不构成实际地形可达性或真实游戏攻击范围验证。未测浏览器进程断电/配额耗尽/跨设备、原大图步行/载具/第一第三人称/旧故事和localStorage迁移、主游戏bundle整合。未测项目不计通过；只建议总控按所有权审计并集成此冻结模块后，另做原游戏联合实机验收。未读取密钥、收费生成、删除冻结证据、提交/推送或修改主控制文档。
