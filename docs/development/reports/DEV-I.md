# DEV-I-R3 原世界边界配置

2026-09-12，按总控 `01a094be-fe94-7c23-9b24-13f777c81d8d` 新切片授权完成。正式DEV任务 `01a094d9-4b8a-7890-a238-0effc66ca873`，工作区 `C:/Users/HUAWEI/.codex/worktrees/7737/star-abyss-game`，Git基线 `5fdb455d3c46601ebd584e64bcf72a2b5c82baf4`、detached HEAD不变。实际代码基线是已集成并独立通过的DEV-I-R2，不是Git旧HEAD。

**DEV-I-R3开发交付冻结，等待总控新建TEST-I-R3独立验收。** Node15/15（原R2的14项含7场景组，新增1项含5个R3组）；真实IDB新5/5、适配器1/1、原R2场景回归7/7；真实页面刷新后整根一致。开发自测不是独立验收，未运行完整原游戏大地图。

## R3依据与正式调用合同

已读主 `docs/development/ORIGINAL_GAME_REBASE.md`，唯一产品仍原 `playable/star-abyss.html`，原米制世界halfSize3000、spawn(0,190)、俯仰±1.35。CORE正式任务 `01a095eb-c6dc-7bd2-a512-3889505e68a5` 已确认下述合同，总控批准显式配置贯穿方案，不增加根自报profile或任意扩展字段。

```js
const sceneConfig = {
  playerId: originalStablePlayerId,
  safePoint: { x: 0, z: 190, yaw: 0, pitch: 0 },
  poseBounds: {
    xMin: -3000, xMax: 3000, zMin: -3000, zMax: 3000,
    pitchMin: -1.35, pitchMax: 1.35
  }
};
const storage = await openIndexedDB({ name: databaseName, sceneConfig });
const session = createSession({ storage, definitions, spatialQuery, authorize, materialize, sceneConfig });
validateRoot(root, sceneConfig); // 直接检查大图根时也必须传同一固定配置
```

- `sceneConfig.poseBounds`严格可选，恰好六个字段。x/z界限必须有限且在[-10^9,10^9]内，min<max；pitchMin/pitchMax有限、min<max且均在[-π/2,π/2]。safePoint按同一bounds验证。不能传null、缺字段、额外字段、NaN/Infinity或倒置界限。
- 玩家与敌人x/z使用同一严格开区间；CORE采用±3000，不把.42碰撞radius重复扣在存档规则里。pitch仅玩家，闭区间；yaw仍[-π,π]，由CORE把原yaw规范化。敌人上限16不变，pending等规模/真实成员ID/根时钟/场景白名单完全保留。
- 旧两字段sceneConfig没有poseBounds时，完整保持R2 x(-24,24)、z(-49,18)、pitch[-.3,.65]。无config同样不放宽。scene/root没有新增profile/bounds字段，也不会从请求或根自报边界推断世界范围。
- `validateRoot(root,sceneConfig?)`新增可选第二参数。session的load、业务末尾根校验，所有checkpoint/cast/hit/transfer/spawn附scene与rescue均使用同一深复制配置。createRoot无scene初始根仍兼容；CORE首次checkpoint写大图scene。
- `openIndexedDB`新增可选sceneConfig，在打开数据库前验证/深复制。read/load验证读出的根；initialize与CAS校验nextState；同一readwrite事务内读取的current根也按自身固定配置验证，再检查revision与put。错误全根拒绝，不截断、不重置、不另开世界掩盖错误。
- 适配器新增同步`assertSceneConfig(sessionConfig)`，session创建时自动调用。配置化adapter与session配置必须canonical完全一致（含playerId/safePoint/bounds），不一致抛sceneConfigurationMismatch、无写入。为兼容R2旧调用，未配置adapter仍允许session的原两字段默认小图配置；任何显式poseBounds都须adapter同步提供。自定义storage若不实现此方法，宿主仍须自行保证它的存储约束；本轮验证的真实IDB明确实现。
- 两边都在任何await前独立复制配置；之后修改调用方原对象不改变边界/安全点。固定配置不写进根，所以宿主必须在重开同数据库时继续提供正确配置；不提供持久profile自动迁移或跨配置识别。当前大坐标档以无config reader读取报invalidScenePose并保持数据库不变，不承诺向旧reader降级写入。

checkpoint/rescue请求严格白名单不变，不能夹带poseBounds/sceneConfig/playerId/安全点/HP。业务scene也不能有bounds扩展袋。本轮没有增加传送、资源、HP或角色数量API。rescue仍仅真实A致死且授权通过后恢复同玩家固定点，保留库存/敌人已受伤HP/世界/掉落/唯一账/历史收据，原施放中断，单次根CAS成功才发布。原故事/旧localStorage身份关联与原玩家移动仍由CORE处理，本DEV未访问或改动它们。

## R3变更和冻结证据

开始时`prepare-r3.cjs`对主INTEGRATED-I-R2逐条核验主目录与总控冻结来源，并核对本工作区26个R2文件，全部字节/哈希相同。记录为新 `playable/src/d3-session/evidence-r3/baseline.json`。该准备器只应在未改R2基线时运行，交付后无需重跑。

相较R2只修改已有五个文件：`d3-session/scene.mjs`、`index.mjs`、`indexeddb.mjs`、`playable/tests/d3-session.test.js`、本报告。测试中的R2断言原样保留，只把生成证据路径改到evidence-r3，避免覆盖旧JSON。新增prepare-r3.cjs和evidence-r3下用例/服务/验证页面/最终核验脚本，以及version-r3.json。产品接入只需三个修改模块；其余为开发测试与证据。

`version-r3.json`保存完整自有文件清单SHA-256/字节、26文件R2基线哈希与7份只读依赖哈希。finalize核验总控冻结R2全部基线文件仍匹配，并拒绝除这五个文件外任何旧文件发生变化。R1/R2 version、TAP、JSON证据均保留原字节。没有修改主目录、CORE文件、A/B/C、原游戏入口/main/package/bundle或公共资产；没有构建、集成、提交或推送。

## R3测试步骤与实际结果

在7737工作区，cmd：

```bat
node --test playable/tests/d3-session.test.js
node playable/src/d3-session/evidence-r3/serve.cjs
node playable/src/d3-session/evidence-r3/finalize.cjs
git diff --check
```

Node15/15退出0；finalize真实复跑并保存`evidence-r3/node.tap`，对自有JS/MJS/CJS做语法检查，核验历史与依赖，最后生成version-r3。旧finalize/finalize-r2/replay-r1-r2均未执行，不覆盖旧证据。git diff --check对未跟踪新文件不构成完整正文验证。

真实内置浏览器打开 `http://127.0.0.1:4185/d3-session/evidence-r3/verify.html`，点击“运行R3及R2回归”，实际页面显示R3 5/5、适配器1/1、R2 7/7。随后实际`tab.reload()`，点击“刷新后重载最后世界”，显示“完整根快照完全一致”。这是局部存储验证页，明确不是替代原游戏的另一套玩法。

|证据（均在evidence-r3）|实测内容|
|---|---|
|node.json、browser.json|±2999.58与负坐标、pitch±1.35、严格边界拒绝、非法配置/请求注入；大坐标业务附scene、敌人同界限；checkpoint put后abort/丢响应/重载后原请求保留新位置；配置复制与session/adapter错配；真实玩家致死后大图救援/原敌伤保留/旧cast中断|
|adapter.json|真实IDB创建后修改原配置仍能保存大坐标；无config reader读取拒绝；非法nextState CAS拒绝且整根不变；非法配置在open前拒绝|
|r2-node-regression.json、r2-browser-regression.json|原R2七组原断言在R3实现上通过；前者内存CAS，后者真实IDB|
|refresh.json|实际页面刷新后重新打开数据库，救援后根与刷新前完整canonical快照一致，含worldId/revision和完整根|
|baseline.json、node.tap|R2基线三方核验及最终Node实际输出|

本轮真实IDB是原生浏览器存储，未使用fake-IDB；Node明确只是内存协调回归。未执行原游戏走遍边缘、载具/旧故事/相机输入联调、真实空间可达性、浏览器进程断电、配额耗尽或跨设备同步；这不表示原大地图已完成实机验收。CORE已同意adapter/session同传固定配置、无scene初始根兼容、失败不清档/不新建世界。交付后由总控新建TEST-I-R3，CORE最终仅用独立通过版本。

---

# DEV-I-R2 场景 checkpoint 与失败救援（历史）

2026-09-12。总控 `01a094be-fe94-7c23-9b24-13f777c81d8d` 授权解除本DEV冻结，仅补单一场景持久化/救援切片。DEV正式ID仍 `01a094d9-4b8a-7890-a238-0effc66ca873`，工作区 `C:/Users/HUAWEI/.codex/worktrees/7737/star-abyss-game`，detached HEAD与基线 `5fdb455d3c46601ebd584e64bcf72a2b5c82baf4` 不变。**R2开发完成并冻结，等待全新TEST-I-R2独立验收，不自行集成。**

开发结果：Node **14/14**（原13项原断言保留，新增1个wrapper实际执行7组R2场景断言）；I-R1独立用例对R2的Node回归 **10/10**；真实浏览器IndexedDB **R2 7/7、原独立回归10/10**。以上均由开发执行，不冒充独立R2验收或D1 3D场景验收。

## R2依据与跨任务协调

重新读取主CONTROL与02/07失败救援规则，联系DEV-D1正式任务 `01a094f4-f011-7893-b92b-4005f9a918c8`，采用D实际model.mjs字段合同。D已确认移除直接根CAS/存储包装，改用本次checkpoint与业务附scene。总控明确取舍：按27与本轮指令保留库存/所有尸体/稳定掉落/唯一账；02旧条文的“未领取掉落遗失、5%耐久损耗”不在此切片实现，没有耐久模型便不伪造扣损。保留角色其他字段，不洗掉后遗症或装备状态。

## R2新增合同

`createSession`新增可选且固定的`sceneConfig`，创建时严格验证并深拷贝，后续调用方改原对象不会影响会话：

```js
const sceneConfig = {
  playerId: 'explorer',
  safePoint: { x: 0, z: 12, yaw: 0, pitch: 0.2 }
};
const session = createSession({ storage, definitions, spatialQuery, authorize, materialize, sceneConfig });
await session.execute({ worldId, transactionId, expectedRevision, simTime, kind: 'checkpoint', scene });
await session.execute({ worldId, transactionId, expectedRevision, simTime, kind: 'rescue' });
```

playerId须存在于根combat.actors且不能是C怪物成员。安全站是宿主固定配置的已建立救援联系位置，不从单次请求选择；本模块验证坐标范围，实际安全区联系/地形/碰撞仍由D授权及固定配置负责。rescue不接受scene、playerId、HP、坐标、任意actor补丁或其他附加字段。checkpoint同样只接受公共五字段与scene，不允许顶层夹带combat/inventory/director。公共字段包含worldId、transactionId、expectedRevision、simTime、kind（共五个；checkpoint另加scene）。

scene为严格D1 v1白名单，禁止额外字段：

```js
{
  version: 1, time: simTime,
  player: { x, z, yaw, pitch },
  enemies: { [actualCMemberId]: { x, z, yaw } },
  pending: { [actorId]: { castId, start, due, end, yaw, committed, resolved } },
  cooldowns: { [actorId]: time }, hurt: { [actorId]: time },
  logs: [{ time, text }]
}
```

- 二维XZ，y恒0：x严格(-24,24)、z严格(-49,18)，yaw∈[-π,π]、pitch∈[-.3,.65]。所有数值有限；scene.time必须精确等于本次simTime、范围0..10^12秒。D负责规范化yaw、真实移动/碰撞与时序；本验证不构成反作弊运动学检查。
- enemies最多16条，键为真实C成员的稳定ID，来自root.drops成员账，允许已死/历史成员位置以保留尸体地点；不生成或复活角色。允许暂缺映射：spawn成功返回C真实ID后D确定性补映射，不能用猜测ID。
- pending/cooldowns/hurt每表最多17条，仅固定playerId或实际C成员ID。ID最长2048个UTF-16代码单元。pending必须对应已存在的A cast及其sourceId，interrupted cast拒绝；布尔字段必须boolean，0≤start≤scene.time，start≤due≤end≤start+60秒。cooldown值0..scene.time+3600，hurt值0..scene.time+60。
- logs最多30条，text最多200个UTF-16代码单元，time在0..scene.time。D已获通知不要用向上四舍五入导致日志时间超过当前模拟时间。
- `cast/hit/transfer/spawn`可选附同一scene，先在私有根副本计算真实业务，再严格验证scene，一次根CAS共同保存；scene验证失败业务也不保存。cast附带本次预创建pending可用committed:false，实际cast在验证时已经存在。hit的resolved状态由D给出，不由I假造动画状态。

`checkpoint`只替换合法scene、推进统一simTime/根revision并追加根收据；不改变combat、inventory、director、drops、events。普通旧请求未附scene而根已带合法scene时，仅把其time同步为新simTime，位置/前摇其余字段保留；推荐D业务始终附scene。

`rescue`仅在当前authorize返回true、固定玩家真实HP=0且A.hits有该玩家实际defeated致命结果时接受。初始手造HP0但无A致命结果不能冒称真实战败。只在根副本显式写该玩家`hp=maxHp`、`resource=baseResource(realm,level)`，不改ID/maxHp/境界/等级/装备加成/盾精度/其他actor字段。scene.player回固定safePoint，scene.time=simTime，pending/cooldowns/hurt清空；enemies位置、logs保留。所有既存未中断cast标interrupted（包括历史完成cast的中断标记，其他cast字段/精确余数/targets/hits全保留），阻断救援前施放的任何新命中段。不删收据、伤害记录、事件，不新增奖励或清掉落。已提交hit原请求重试仍由根收据返回最新根，不重新施伤；新ID尝试旧cast未结算段会被A中断检查拒绝。

新增导出`validateScene(scene,root,sceneConfig?)`、`validateSceneConfig(config)`，实现位于新`scene.mjs`并从index重导出。没有通用patch API。IDB实现本轮原字节不变，继续在同一readwrite事务检查根revision并put完整根及收据，oncomplete后才发布。

### 兼容与恢复

I-R1无scene字段的根在R2下不自动添加字段、不重建业务状态，原13项和独立10组已回归。建立scene须checkpoint，rescue缺scene/config明确拒绝。已有合法D1 scene按v1验证保留；不支持任意未知旧scene/null/缺字段，报错而不静默清空。根schemaVersion仍1（新增可选scene）；建立scene后不支持回退旧I-R1写入器继续写，因为旧写入器可能留下scene.time不一致。

每次execute在await前复制请求，读取权威根、检查原收据和版本，然后授权/计算/一次根CAS。异步授权期间另一请求胜出会令旧请求commitRejected，不能覆写新场景或业务。满包、非法scene、取消、授权拒绝、IDB put后abort均不发布副本。rescue与checkpoint丢响应后重开连接并重放完整原请求，只读原收据，返回最新根/events空数组；不再回安全站覆盖后来移动。已提交事务改时间/版本/payload仍冲突。

## R2改动文件与证据隔离

相较冻结I-R1，现有文件只修改：`playable/src/d3-session/index.mjs`、`playable/tests/d3-session.test.js`、本`DEV-I.md`。新增自有目录文件：`scene.mjs`、`scene-cases-r2.mjs`、`verify-r2.html`、`serve-r2.cjs`、`replay-r1-r2.cjs`、`r1-independent-r2.mjs`、`finalize-r2.cjs`，以及R2专用JSON/TAP/版本证据。

`version-r2.json`记录所有自有文件内容SHA-256、字节、added/modified/unchanged、7份只读依赖哈希及20份原冻结R1文件逐字节核验结果。原`version.json`、`node-tests.tap`、`browser-evidence.json`及其他R1证据未覆写；报告以下R1章节作为历史保留。主总控冻结 `c0e3/.../artifacts/deliveries/DEV-I-R1` 与TEST工作区 `62b6/.../artifacts/tests/TEST-I-R1` 均只读、未修改。没有改主目录、A/B/C、main/package/game.js、公共资产，也没有构建/集成/提交/推送。

I-R1独立回归复制仅把其independent.mjs的import前缀 `./frozen/playable/src/` 改为 `../`，所有用例、断言、预期保持原文。`r1-regression-r2.json`记录原路径、原/副本SHA-256、改动说明与10组完整新运行结果。未运行旧TEST的run-node/server写证据驱动；Node适配仍明确内存CAS，浏览器才是真实IDB。

## R2实际测试与复跑

在7737工作区，cmd执行：

```bat
node --test playable/tests/d3-session.test.js
node playable/src/d3-session/replay-r1-r2.cjs
node playable/src/d3-session/serve-r2.cjs
node playable/src/d3-session/finalize-r2.cjs
git diff --check
```

前两项退出0，Node14/14与原独立10/10。finalize-r2真实复跑它们、对自有mjs/cjs执行node --check、验证原冻结20文件及依赖，再生成`node-tests-r2.tap`、`version-r2.json`；不执行旧finalize覆盖旧证据。git diff --check只覆盖已跟踪diff，不将其当未跟踪新文件完整检查。

浏览器入口 `http://127.0.0.1:4180/d3-session/verify-r2.html`，使用Codex内置浏览器真实点击两个按钮并读取页面结果：

|执行|实际结果与证据|
|---|---|
|运行场景与救援7组|7/7；`scene-browser-r2.json`完整before/after/请求/异常/最终根，含UA与时间|
|回归I-R1独立10组|10/10；`r1-browser-regression-r2.json`完整步骤，实际openIndexedDB，无fake-IDB|
|R2 Node组|7/7包含在第14个Node test内；`scene-node-r2.json`|
|原独立Node回归|10/10；`r1-regression-r2.json`|

R2七组依次覆盖：严格字段/有限数值/边界/规模/稳定ID及无scene旧根；cast附scene共同commit与checkpoint真实put后abort；活玩家/缺配置/请求夹带恢复值拒绝；真实A致死后同玩家安全站恢复、资产/历史逐字段不变与旧cast拒绝；rescue abort/已提交丢响应/关闭重开连接/后续位置进度/原请求重放；异步授权并发胜者与授权拒绝/取消；checkpoint丢响应去重及固定配置深拷贝。

开发真实浏览器验证用了同源IDB事务、真实A伤害结果和接口，不是D1场景操作。未测浏览器进程断电、配额耗尽、跨浏览器设备、真实安全站联系/3D动画/碰撞/玩家手动输掉战斗后点击救援；这些由后续D1和独立TEST分别覆盖。新入口只承诺局部验证，未改旧游戏输入/视角。

最终合同已直接通知D1，D已接受；交付后发总控报告与`version-r2.json`，等待总控全新TEST-I-R2。D最终冻结只能采用独立通过R2，不把开发14/14、浏览器7/7当作验收。开发到此停止扩展。

---

# DEV-I-R1 历史同根存档联动报告（保留）

正式任务 `01a094d9-4b8a-7890-a238-0effc66ca873`；总控 `01a094be-fe94-7c23-9b24-13f777c81d8d`。
工作区 `C:/Users/HUAWEI/.codex/worktrees/7737/star-abyss-game`；detached HEAD；基线 `5fdb455d3c46601ebd584e64bcf72a2b5c82baf4`。

2026-09-12，交付 **DEV-I-R1**。开发自测 Node **13/13**，Codex 内置浏览器真实 IndexedDB 套件 **6/6**；实现、测试与报告冻结，等待总控另建全新 TEST-I。**开发自测不是独立验收；未接主游戏、3D或真实空间判定。**

## 依据、所有权与版本

已读取权威主目录 `E:/myProject/star-abyss-game` 的 CONTROL（含DEV-I全节）、TASKS、CONTROL-R1、DEV-A/B/C、TEST-A-R2/TEST-B-R1/TEST-C-R2及三个INTEGRATED清单。实际全局规则为 `C:/Users/HUAWEI/.codex/AGENTS.md`，遵守cmd优先。当前可用工具未提供codegraph索引，使用局部导出/函数范围阅读。初始工作区干净；所有变更仍未提交，无分支创建、推送、集成或构建。

新增产品代码只有 `playable/src/d3-session/index.mjs`（根协调）、`indexeddb.mjs`（真实存储）。同目录验证入口/支持文件：`verify.html`、`browser-verifier.mjs`、`demo-fixture.mjs`、`serve.cjs`、`verify-dependencies.cjs`、`finalize.cjs`；证据：`browser-evidence.json`、`node-tests.tap`、`version.json`。另有自测 `playable/tests/d3-session.test.js` 与本报告。临时源码阅读辅助脚本已删除。

默认基线不含A/B/C。按INTEGRATED清单先核验主目录所有条目，再仅复制下列三个模块目录中的7文件作为只读import依赖；未复制其他测试/报告/整仓。核验器遇到不同内容立即拒绝，不覆盖现有文件。结束时再次核验全部一致。

|只读依赖相对路径|SHA-256|
|---|---|
|playable/src/d3-combat/fixed.mjs|434e3ace9d094fd4212b38381981c2394cba0b3ebe234706afcc885fb8424f59|
|playable/src/d3-combat/index.mjs|06877a2dd12a0a11a6a7dbf3d2fe4979b8cf28d4f41436255352c806756476d4|
|playable/src/d3-inventory/index.mjs|3a63f4cc0278ef1ed9e4e6dd8526a4530bab8fb3fe05796f0dfde49c370dd566|
|playable/src/world-director/definitions.mjs|3d208976f511b0ec4686d725a502f412950fd08593de4a4f9048f99a9ab060ef|
|playable/src/world-director/director.mjs|26110459c1fe4a24da3331e9d006118dfabb451fa8481a9cb7e485495d0cf358|
|playable/src/world-director/rng.mjs|3460f390a4ea4118542788f5afa7407e5746ea2839a47bf32f4040b0e7f8ed02|
|playable/src/world-director/verification/replay-r1.cjs|2fc7fd84486c822e019ea3abd489489bf95ae843b1eb8c2df455b6e922d35b6a|

最后一项仅随获准模块目录复制、核验，未执行，不是运行时依赖。自有源码、测试、报告和证据的逐文件SHA-256/字节在 `playable/src/d3-session/version.json`；清单自身不自哈希。冻结后不要执行finalize或覆写证据；独立TEST应先复制/核验明确版本再执行。

## API和数据合同

`index.mjs` 导出 `createRoot`、`validateRoot`、`createSession`、`copy`、`canonical`。

- `createRoot({worldId,combat,inventory,director,simTime=0})` 仅创建/导入初始根，不是运行时奖励接口。初始C锚点应未显现；运行时用spawn建立真实ID映射。已登记完整唯一物可在初始库存与C账共同存在，必须item/root/持有人完全一致。
- 根为JSON：`schemaVersion:1, worldId, revision, simTime, combat, inventory, director, receipts[], events[], drops[]`。A状态原样保存，包含version2、carryExact、amountExact、casts/hits；duplicate返回新state也保存。根收据包含transactionId、完整请求canonical签名、提交revision/simTime/eventIds。死亡drop保存memberId、C lootSeed、created、container、manifest，死亡成功后加eventId。manifest在生成时一次确定并随根保存，拾取不修改它，实物数量由inventory保存。
- `createSession({storage,definitions,spatialQuery,authorize,materialize})` 返回 `load(worldId)`、`execute(request,{signal}?)`。必须显式提供存储、definitions、同步空间查询与授权函数；spawn还必须有同步materialize。异步materialize、缺少配置、不支持的动作和非法请求均拒绝。authorize可异步，只返回true才继续；其检查是场景适配契约，演示true夹具不是实际命中/距离证明。
- 请求公共字段：`{worldId,transactionId,expectedRevision,simTime,kind,...}`。simTime是秒单位有效模拟时间，由宿主固定在该根操作输入中，不能倒退；暂停/重载由宿主恢复同一时间线，所有本次C变更读取同一固定值，不使用系统时间。failed请求不推进存档时间。改payload或simTime、expectedRevision后复用已提交事务ID报transactionIdConflict。
- kind=`spawn`：`anchorId,context?`；调用C plan→reserve→commit，使用其返回的instanceId/members/lootSeed。materialize(instance)返回资源 `{container,items[]}` 或怪群 `{members:[{actor,container,loot:[]}...]}`，成员顺序对应C数组。factory应纯、确定且无副作用；资源数量总和必须等于C remaining，所有容器容量有限，清单不得超容量。ID由协调器以JSON元组生成，覆盖工厂ID。新代保留原资源/尸体、历史与所有去重依据；不替用户清垃圾。
- kind=`cast`：`cast`为A commitCast原请求，内部worldId仍由A检查。kind=`hit`：`hit`为A resolveHit原请求。只使用A本次events，历史result不重新扣血、不当作新事件。真正HP归零且符合defeatEligible的C成员才创建一次尸体实物并消费C成员；满包只拒绝随后拾取，不抹去尸体。不接受外部传入committed事件作为动作。
- kind=`transfer`：`operations[]`仅支持B完整transfer字段，可用于有限资源采收/尸体拾取/普通库存/完整唯一物。B真实成功才镜像部分remaining或消费resourceDepleted。唯一物必须已有C完整持有记录、B原ID/root一致，目标容器必须有holderId；C transfer与B同根提交。拆分动作、consume、唯一片重铸和无持有人托管不在本切片支持范围，明确拒绝。
- 返回 `{state,receipt,events,replayed}` 只在真实根CAS成功之后发布。重试已提交原请求返回当前最新权威根、原收据、events空数组和replayed=true，不返回旧快照覆盖新进度。receipt.eventIds是历史记录，不能重发奖励。

库存spawn/掉落新增会推进inventory revision；B转移自行推进子revision。外部只能使用根execute，不能独立将某个子快照写回或仅按B/C子版本并发。所有子态在本次私有根副本计算；B scratch CAS实际检查版本并替换副本，C persist同步检查版本并替换副本，二者只确认临时计算，**均不是落盘成功**。真实持久化只有最后的一次根CAS。没有把async IndexedDB传给C.persist。

`indexeddb.mjs` 导出 `openIndexedDB({name,indexedDB=globalThis.indexedDB,fault?})`，返回 `load`、`initialize(root)`、`compareAndSwap({worldId,expectedRevision,nextState,signal?})`、`close`。initialize只在键不存在时保存revision0，已有档返回false且不覆盖。CAS在同一个readwrite事务get当前根、检查revision、put整个根含收据/events，只有oncomplete才返回true；版本不符返回false，abort抛错。signal取消会尝试abort活跃事务；提交已完成后的取消不能撤销既成事实。`fault(stage)`仅验证注入：afterPut返回abort触发真实tx.abort，afterCommit返回loseResponse模拟已保存后丢失响应。生产应省略fault。

## 失败恢复和边界

取消/授权拒绝/满包/工厂非法/子模块异常/根CAS拒绝/真实IDB abort都不发布副本。无公共可变缓存；每次load和execute都读取权威存储。响应丢失必须重载后提交完整原请求，已存收据去重；若数据库显示请求从未保存且世界版本已被其他事务推进，原请求明确revisionConflict，宿主重新表达新意图时必须换事务ID并重新授权。不存在把旧子态补写回最新根的修复路径。

UI不应凭根调用异常判断业务必然未发生，也不能凭重放receipt当新事件。更新视图以返回state或权威load为准。事件收据与drop清单目前不压缩，长运行性能/档案回收、损坏存档修复/旧A-R1补偿、浏览器清理/配额/断电、跨设备同步、实际关闭浏览器进程后重开未验证。浏览器测试是两个独立IDB连接，并非两个独立浏览器进程。

本地fixture明确使用逻辑空间布尔和授权true；初始完整唯一物是已创作的测试库存与C登记，不伪称A/B奖励来源。运行时耗尽/死亡事件来源分别为真实B/A成功。尚未接main/3D/UI、NPC/宠物、完整加工、输入/相机/载具、实际空间安全、地图落点、动画命中判定。没有改主目录、main.mjs、package.json、game.js、公共资产，没有构建主包、收费资产或密钥读取。

## 实际验证命令、结果和证据

工作目录为本报告开头的7737工作区；cmd、Node v22.14.0。

```bat
node playable/src/d3-session/verify-dependencies.cjs
node --test playable/tests/d3-session.test.js
node playable/src/d3-session/serve.cjs
node playable/src/d3-session/finalize.cjs
git diff --check
```

依赖7文件一致；Node最终 **13 tests / 13 pass / 0 fail**；finalize真实复跑测试并保存 `node-tests.tap`，对所有自有mjs/cjs执行node --check，之后记录版本清单。git diff --check退出0，但新增未跟踪文件不在其检查范围，不能据此声称新文件全部自动审查。

Node断言覆盖：部分/最终采收及C时钟/令牌；满包/取消/授权拒绝；根false/异常全回滚及恢复；丢响应后重载且保留后续唯一物进度；并发数量守恒；A 1/3精确余数跨根保存、实际死亡、alias新态与冲突；满包尸体保留并拾取；死亡提交失败再恢复；B/C唯一身份/持有人同根；C实际新代ID与历史；拒绝伪造事件/倒退时钟；异步授权期间取消/调用方请求变更隔离；最后怪物一次空缺及所有掉落保留；缺失/async/非法factory拒绝。Node存储明确为内存CAS，不能代表IDB。

早期准备命令中python不存在、node -e的cmd引号解析失败、Git Bash启动不可用；随后全部改为cmd运行自有cjs，没有依赖这些失败命令作证明。首轮Node 8/10因为demo分段权重错误使用[1,1,1]，A依法拒绝；修正为[.25,.25,.5]并用攻击4后10/10，补断言后最终13/13。未修改A契约或绕过检查。

### 真实浏览器复跑步骤

1. 启动serve，访问 `http://127.0.0.1:4177/d3-session/verify.html`。这是局部HTTP模块入口，不能直接file://双击当作相同IDB origin。
2. 点击“运行真实 IDB 故障套件”。每轮创建唯一worldId，数据库 `DEV-I-suite-v1`；不删除旧存档。页面必须出现6条PASS及6/6。它真实import产品模块并操作globalThis.indexedDB，无fake-indexeddb。
3. 六组包括：真实有限生成/部分/满包；采收put后tx.abort全根不变；两个连接并发一胜且物资守恒；唯一物先abort确认双态不变、再afterCommit丢响应，关闭并重开连接后原请求去重；真实A精确余数与死亡前abort、死亡一次/尸体满包/别名/拾取；取消无写入。
4. 套件通过后以POST写本目录 `browser-evidence.json`，含浏览器UA、时间、每组完整before/after、请求/错误、最终根。最终代码版本已重新点击运行并确认6/6。证据仅使用本机测试数据。
5. 手动点“初始化 / 重载演示存档”→“生成一处资源”→“采收一份”，观察root revision 1→2，均events0（部分采收）。展开完整根，保存其显示文本；真实刷新页面，再点初始化/重载。开发实际比较刷新前后完整JSON字符串 **fullSnapshotEqual:true**，revision仍2。
6. “生成怪群并击败一只”“拾取尸体清单”“转移完整唯一物”是同一实际接口的手动入口；本轮手动只点了初始化/资源/采收/刷新，战斗/拾取/唯一转移由上述真实浏览器套件执行。不要把未逐按钮点击描述为完成全部手动场景验收。

浏览器实际环境为Codex内置浏览器（UA见JSON，Chromium）。已检查页面截图，当前视口下中文可读、按钮换行无重叠或截字，展开长JSON可滚动。未做手机/所有窗口尺寸验收。页面刷新文字一致的证据在本任务CUA工具输出；截图已在任务输出展示，未另存截图文件。

## 交回总控和下一步

交付冻结后向总控正式ID发送本报告及version.json路径。请另建全新TEST-I直接核验这个版本和真实IDB，开发自测不当验收；失败回本DEV修复并另建复测。通过后只集成本切片拥有文件，A/B/C无需重新覆盖。再派D接实际模拟时钟、空间/授权/命中和地图factory，从一处草、一只怪、一包及真实落点开始，使用根execute与权威load，不单独保存子模块。不继续扩展本切片。
